const path = require('path');
const fs = require('fs');

// Đọc metadata từ file gốc
const originalContent = fs.readFileSync('./King-Translator-AI.user.js', 'utf8');
const metadataMatch = originalContent.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
const metadata = metadataMatch ? metadataMatch[0] : '';

class UserScriptHeaderPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('UserScriptHeaderPlugin', (compilation, callback) => {
      // Thêm metadata và IIFE wrapper vào file output
      for (const filename in compilation.assets) {
        if (filename.endsWith('.user.js')) {
          const originalSource = compilation.assets[filename].source();

          // Thêm initialization check như file gốc
          const initCheck = `  if (window.kingTranslatorInitialized) {
    console.log("King Translator: Already initialized, skipping this execution.");
    return;
  }
  window.kingTranslatorInitialized = true;\n`;

          // Wrap trong IIFE như file gốc
          const wrappedSource = `(function() {\n  "use strict";\n${initCheck}${originalSource}\n})();`;
          const newSource = `${metadata}\n${wrappedSource}`;

          compilation.assets[filename] = {
            source: () => newSource,
            size: () => newSource.length
          };
        }
      }
      callback();
    });
  }
}

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'King-Translator-AI-rebuilt.user.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'production',
  optimization: {
    minimize: false, // Không minify để dễ so sánh
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      }
    ]
  },
  plugins: [
    new UserScriptHeaderPlugin()
  ],
  resolve: {
    extensions: ['.js']
  }
};
