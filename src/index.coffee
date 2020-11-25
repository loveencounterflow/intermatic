'use strict'

do =>
  Intermatic = require './main.js'
  if globalThis.window?
    globalThis.Intermatic = Intermatic
  else
    module.exports = Intermatic
  return null

