'use strict';
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

// Phát hiện thật khi test: tạo mới 1 readline.Interface cho MỖI câu hỏi (rồi close ngay)
// làm câu hỏi thứ 2 trở đi bị treo khi stdin đến từ pipe (vd `printf ... | company-ai end`)
// — interface sau không nhận được phần dữ liệu còn lại đúng cách. Dùng chung 1 interface
// suốt vòng đời lệnh, chỉ close() đúng 1 lần lúc CLI thoát.
let sharedRl = null;
function getRl() {
  if (!sharedRl) sharedRl = readline.createInterface({ input: stdin, output: stdout });
  return sharedRl;
}
function closeRl() {
  if (sharedRl) {
    sharedRl.close();
    sharedRl = null;
  }
}

async function ask(question, defaultValue) {
  const rl = getRl();
  const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || defaultValue || '';
}

async function askYesNo(question, defaultYes) {
  const answer = await ask(`${question} (${defaultYes ? 'Y/n' : 'y/N'})`, defaultYes ? 'y' : 'n');
  return answer.toLowerCase().startsWith('y');
}

module.exports = { ask, askYesNo, closeRl };
