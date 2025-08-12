
/*
  Calculator behavior:
  - Numbers and dot build the current input.
  - Pressing an operator stores the current value and chosen op.
  - Pressing = sends a SOAP request to the Calculator API (Add/Subtract/Multiply/Divide)
    with the stored value and current input, then shows the response.
  - 'C' clears everything.
  - All operations use the same SOAP API endpoints (so functionality remains unchanged).
  - NOTE: The SOAP API expects numeric values (integers work best). Division from the API is integer division.
*/

/* --- Config: CORS proxy and target --- */
// If you run into CORS issues, use a proxy. Example below uses cors-anywhere.
// To use cors-anywhere you may need to visit https://cors-anywhere.herokuapp.com/corsdemo and request access.
const useProxy = true;
const corsProxy = "https://cors-anywhere.herokuapp.com/"; // testing only
const targetUrl = "http://www.dneonline.com/calculator.asmx";
const soapBaseUrl = (useProxy ? corsProxy : "") + targetUrl;

/* --- State --- */
let displayEl = document.getElementById('display');
let statusEl = document.getElementById('status');

let currentInput = "0";       // string for the number being entered
let storedValue = null;       // string or number stored when op is pressed
let pendingOp = null;         // one of: Add, Subtract, Multiply, Divide
let entering = true;          // true when building a number

/* helpers */
function updateDisplay(text) {
  // limit length
  const str = String(text);
  if (str.length > 12) {
    displayEl.textContent = Number(str).toPrecision(10);
  } else {
    displayEl.textContent = str;
  }
}

/* map operator symbol to SOAP operation name */
function opToSoap(opSymbol){
  switch(opSymbol){
    case '+': return 'Add';
    case '-': return 'Subtract';
    case '*': return 'Multiply';
    case '/': return 'Divide';
    default: return null;
  }
}

/* build SOAP XML body */
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

/* send SOAP POST and parse result */
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

    if(!resp.ok){
      throw new Error('HTTP ' + resp.status);
    }

    const text = await resp.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const tag = xml.getElementsByTagName(`${operationName}Result`)[0];
    if(!tag){
      throw new Error('Invalid SOAP response');
    }
    statusEl.textContent = '✔ Done';
    return tag.textContent;
  } catch (err){
    statusEl.textContent = '❌ ' + err.message;
    throw err;
  }
}

/* number button pressed */
function onDigit(d){
  if(!entering){
    currentInput = d === '.' ? '0.' : d;
    entering = true;
  } else {
    if(d === '.' && currentInput.includes('.')) return;
    if(currentInput === '0' && d !== '.') currentInput = d;
    else currentInput = currentInput + d;
  }
  updateDisplay(currentInput);
}

/* operator pressed */
function onOperator(sym){
  // if user presses op in succession, just update op
  if(pendingOp && !entering){
    pendingOp = sym;
    statusEl.textContent = `Op set to ${sym}`;
    return;
  }

  // store current input
  storedValue = currentInput;
  pendingOp = sym;
  entering = false;
  statusEl.textContent = `Op set to ${sym}`;
  updateDisplay(sym);
}

/* equals pressed */
async function onEquals(){
  if(!pendingOp || storedValue === null){
    statusEl.textContent = '⚠ No operation selected';
    return;
  }

  // Use storedValue and currentInput as operands
  // SOAP service expects numbers (use as-is). We'll pass them as-is; API uses integer semantics.
  const opName = opToSoap(pendingOp);
  if(!opName){
    statusEl.textContent = '⚠ Unsupported op';
    return;
  }

  // show interim
  statusEl.textContent = '⏳ Sending to SOAP...';
  try {
    // send numbers — trim to avoid huge strings
    const a = storedValue;
    const b = currentInput;
    const result = await callSoapOperation(opName, a, b);
    currentInput = String(result);
    updateDisplay(currentInput);
    // clear pending
    storedValue = null;
    pendingOp = null;
    entering = false;
  } catch (err){
    // error already set in status
  }
}

/* clear */
function onClear(){
  currentInput = "0";
  storedValue = null;
  pendingOp = null;
  entering = true;
  updateDisplay(currentInput);
  statusEl.textContent = '';
}

/* wire buttons */
document.querySelectorAll('button.key').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const action = btn.dataset.action;
    const value = btn.dataset.value;
    if(action === 'digit'){
      onDigit(value);
    } else if (action === 'dot'){
      onDigit('.');
    } else if (action === 'op'){
      onOperator(value);
    } else if (action === 'equals'){
      onEquals();
    } else if (btn.id === 'clear'){
      onClear();
    }
  });

  // also support touch (fast)
  btn.addEventListener('touchstart', (ev) => {
    ev.preventDefault(); // prevent mouse event duplication
    btn.classList.add('pressed');
  }, {passive:false});
  btn.addEventListener('touchend', (ev) => {
    btn.classList.remove('pressed');
  });
});

/* initialize */
updateDisplay(currentInput);
statusEl.textContent = 'Ready';