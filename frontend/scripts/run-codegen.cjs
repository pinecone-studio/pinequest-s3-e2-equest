const Module = require("module");
const path = require("path");

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);

  if (
    request === "chalk" &&
    loaded &&
    typeof loaded.blue !== "function" &&
    loaded.default &&
    typeof loaded.default.blue === "function"
  ) {
    return loaded.default;
  }

  return loaded;
};

require(path.join(__dirname, "../node_modules/@graphql-codegen/cli/cjs/bin.js"));
