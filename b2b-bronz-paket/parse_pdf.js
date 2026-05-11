const fs = require('fs');
const pdf = require('pdf-parse');
let dataBuffer = fs.readFileSync('qnb_api_document_tr.pdf');
pdf(dataBuffer).then(function(data) {
  fs.writeFileSync('qnb_doc.txt', data.text);
}).catch(console.error);
