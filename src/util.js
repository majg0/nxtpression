module.exports = {
  getErrorFormatter
}

function getErrorFormatter (source, getColumn) {
  return function formatError (text, col = getColumn()) {
    const AROUND = 38
    const line = source.slice(Math.max(0, col - AROUND), col + AROUND).replace(/\s/g, ' ')
    const caret = ' '.repeat(Math.min(col, AROUND) + 1) + '^'
    return `At ${col}; ${text}\n\`${line}\`\n${caret}`
  }
}