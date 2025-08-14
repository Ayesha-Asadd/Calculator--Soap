const corsProxy = "https://cors-anywhere.herokuapp.com/";
const targetUrl = "http://www.dneonline.com/calculator.asmx";
const soapBaseUrl = corsProxy + targetUrl;

let displayEl = document.getElementById('display');
let statusEl = document.getElementById('status');

let currentInput = "0";
let storedValue = null;
let pendingOp = null;
let entering = true;

function updateDisplay(text) {
  const str = String(text);
  displayEl.textContent = str.length > 12 ? Number(str).toPrecision(10) : str;
}

function opToSoap(opSymbol){
  switch(opSymbol){
    case '+': return 'Add';
    case '-': return 'Subtract';
    case '*': return 'Multiply';
    case '/': return 'Divide';
    default: return null;
  }
}

function buildSoapEnvelope(operation, a, b){
  return `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <${operation} xmlns="http://tempuri.org/">
        <intA>${a}</intA>
        <intB>${b}</intB>
      </${operation}>
    </soap:Body>
  </soap:Envelope>`;
}

async function callSoapOperation(operationName, a, b){
  statusEl.textContent = '⏳ Fetching...';
  try {
    const body = buildSoapEnvelope(operationName, a, b);
    const resp = await fetch(soapBaseUrl, {
      method: 'POST',
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `http://tempuri.org/${operationName}`
      },
      body: body
    });

    if(!resp.ok) throw new Error('HTTP ' + resp.status);

    const text = await resp.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const tag = xml.getElementsByTagName(`${operationName}Result`)[0];
    if(!tag) throw new Error('Invalid SOAP response');

    statusEl.textContent = '✔ Done';
    return tag.textContent;
  } catch (err){
    statusEl.textContent = '❌ ' + err.message;
    throw err;
  }
}

function onDigit(d){
  if(!entering){
    currentInput = d === '.' ? '0.' : d;
    entering = true;
  } else {
    if(d === '.' && currentInput.includes('.')) return;
    if(currentInput === '0' && d !== '.') currentInput = d;
    else currentInput += d;
  }
  updateDisplay(currentInput);
}

function onOperator(sym){
  if(pendingOp && !entering){
    pendingOp = sym;
    statusEl.textContent = `Op set to ${sym}`;
    return;
  }
  storedValue = currentInput;
  pendingOp = sym;
  entering = false;
  statusEl.textContent = `Op set to ${sym}`;
  updateDisplay(sym);
}

async function onEquals(){
  if(!pendingOp || storedValue === null){
    statusEl.textContent = '⚠ No operation selected';
    return;
  }
  const opName = opToSoap(pendingOp);
  if(!opName){
    statusEl.textContent = '⚠ Unsupported op';
    return;
  }
  try {
    const result = await callSoapOperation(opName, storedValue, currentInput);
    currentInput = String(result);
    updateDisplay(currentInput);
    storedValue = null;
    pendingOp = null;
    entering = false;
  } catch {}
}

function onClear(){
  currentInput = "0";
  storedValue = null;
  pendingOp = null;
  entering = true;
  updateDisplay(currentInput);
  statusEl.textContent = '';
}

document.querySelectorAll('button.key').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const value = btn.dataset.value;
    if(action === 'digit') onDigit(value);
    else if (action === 'dot') onDigit('.');
    else if (action === 'op') onOperator(value);
    else if (action === 'equals') onEquals();
    else if (btn.id === 'clear') onClear();
  });
});

updateDisplay(currentInput);
statusEl.textContent = 'Ready';