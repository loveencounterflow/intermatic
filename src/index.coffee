'use strict'

do =>
  { Intermatic, } = require './main.js'
  if globalThis.window?
    globalThis.Intermatic = Intermatic
  else
    @Intermatic = Intermatic
  return null

