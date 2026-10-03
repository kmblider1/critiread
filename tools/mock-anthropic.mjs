// Anthropic Messages API ning mahalliy soxta serveri (faqat sinov uchun). Ishlatish: node tools/mock-anthropic.mjs
// Maxsus matnlar: so'rovda "TRIGGER_REFUSE" bo'lsa stop_reason=refusal; "TRIGGER_401" bo'lsa 401 qaytaradi.
import http from 'node:http';
let last = null;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_last') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(last)); }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {}; try { body = JSON.parse(raw); } catch {}
    last = { path: req.url, key: req.headers['x-api-key'], body };
    const all = JSON.stringify(body.messages || []);
    if (all.includes('TRIGGER_401')) { res.statusCode = 401; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })); }
    let text, stop = 'end_turn';
    const schema = body.output_config && body.output_config.format && body.output_config.format.schema;
    if (all.includes('TRIGGER_REFUSE')) { stop = 'refusal'; text = ''; }
    else if (schema && schema.properties.criteria) {
      text = JSON.stringify({ criteria: [1, 2, 3, 4, 5].map((i) => ({ index: i, level: 'BCBAC'[i - 1], evidence: 'quote ' + i, reason: 'sabab ' + i })), summary: 'Umumiy xulosa' });
    } else if (schema && schema.properties.questions) {
      text = JSON.stringify({ questions: [0, 1, 2].map((i) => ({ skill: i, passage: '', question: 'Q' + i + '?', options: ['a', 'b', 'c', 'd'], answer: (i + 1) % 4, explanation: 'izoh ' + i })).concat([{ skill: 9, passage: '', question: 'bad', options: ['a'], answer: 7, explanation: '' }]) });
    } else text = 'Javob: ' + String((body.messages || []).slice(-1)[0].content).slice(0, 40);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, content: stop === 'refusal' ? [] : [{ type: 'text', text }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } }));
  });
});
server.listen(8799, () => console.log('mock anthropic on :8799'));
