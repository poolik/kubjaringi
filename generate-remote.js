var execSync = require('child_process').execSync;

Object.defineProperty(Array.prototype, 'chunk', {
  value: function (chunkSize) {
    var R = [];
    for (var i = 0; i < this.length; i += chunkSize)
      R.push(this.slice(i, i + chunkSize));
    return R;
  }
});

function range(start, stop, step) {
  if (typeof stop == 'undefined') {
    // one param defined
    stop = start;
    start = 0;
  }

  if (typeof step == 'undefined') {
    step = 1;
  }

  if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
    return [];
  }

  var result = [];
  for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
    result.push(i);
  }

  return result;
}

function intToMode(mode) {
  if (mode === 0) return 'HEAT';
  if (mode === 1) return 'COLD';
  return undefined;
}

function create_button_name(mode, temp) {
  return intToMode(mode) + "_ON_" + temp;
}
function generate_commands() {
  var temperatures = [10].concat(range(16, 32));
  var modes = [0, 1];

  var commands = [];
  for (var i = 0, len1 = temperatures.length; i < len1; i++) {
    var temp = temperatures[i];
    for (var j = 0, len2 = modes.length; j < len2; j++) {
      var mode = modes[j];
      commands.push(["sudo mitsu " + temp + " 1 " + mode, create_button_name(mode, temp)])
    }
  }
  commands.push(["sudo mitsu 21 0 0", 'OFF']);
  return commands;
}

var header = "begin remote\n" +
    "  name  AC\n" +
    "  flags RAW_CODES\n" +
    "  eps           30\n" +
    "  aeps          100\n" +
    "  frequency    38000\n" +
    "      begin raw_codes\n";

var footer = "      end raw_codes\n" +
    "end remote\n";

var output = header;
var commands = generate_commands();

for (var i = 0, len = commands.length; i < len; i++) {
  var command = commands[i];
  var stdout = execSync(command[0]).toString();
  var timings = stdout.split("\n").chunk(6);
  output += "          name " + command[1] + "\n";
  for (var j = 0, len2 = timings.length; j < len2; j++) {
    var row = timings[j];
    output += "              " + row.join(" ") + "\n"
  }
}

output += footer;
console.log(output);