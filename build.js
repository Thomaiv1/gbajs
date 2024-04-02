await Bun.build({
  entrypoints: ["./js/gba.js"],
  outdir: "./dist",
  target: "node",
});
