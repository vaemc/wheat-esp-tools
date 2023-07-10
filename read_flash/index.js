const { program } = require("commander");


// program.option("--explorer").option("--read_flash");

// program.command("path");
// program.command("com");

// program.parse();

// const options = program.opts();
// console.info(options);

// const limit = options.first ? 1 : undefined;
// console.log(program.args[0].split(options.separator, limit));


program
  .command("explorer")
  .description("在资源管理器中打开选中的文件")
  .argument("<path>", "文件完整路径")
  .action((str, options) => {
    console.log(str);
  });

program
  .command("read_flash")
  .description("读取flash")
  .argument("<port>", "端口")
  .option('--port')
  .argument("<path>", "保存路径")
  .option('--path')
  .action((str, options) => {
    console.log(str);
    console.log(options);
  });

program.parse();

// const { spawn } = require("child_process");
// const args = process.argv.slice(2);
// const cmdProcess = spawn("esptool.exe", [
//   "-p",
//   args[0],
//   "-b",
//   args[1],
//   "read_flash",
//   "0",
//   "ALL",
//   args[2],
// ]);
// cmdProcess.stdout.on("data", (data) => {
//   console.log(data.toString("utf8"));
// });
// cmdProcess.stderr.on("data", (data) => {
//   console.error(data.toString("utf8"));
// });
// cmdProcess.on("close", (code) => {
//   console.log(code.toString("utf8"));
// });

// // node .\index.js COM12 460800 123.bin

// const { exec } = require('child_process');
// const path = require('path');

// const filePath = 'D:/2023/js/esp32-tools/src-tauri/target/release/firmware/hello-world-printf.bin'; // replace with your file path

// const command = `explorer.exe /select,"${path.normalize(filePath)}"`;

// exec(command, (err, stdout, stderr) => {
//   if (err) {
//     console.error(err);
//     return;
//   }
//   console.log(`stdout: ${stdout}`);
//   console.error(`stderr: ${stderr}`);
// });




