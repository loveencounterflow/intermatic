
'use strict'


# ############################################################################################################
# CND                       = require 'cnd'
# rpr                       = CND.rpr
# badge                     = 'MKTS-GUI-TOOLBOX-FSM'
# debug                     = CND.get_logger 'debug',     badge
# warn                      = CND.get_logger 'warn',      badge
# info                      = CND.get_logger 'info',      badge
# urge                      = CND.get_logger 'urge',      badge
# help                      = CND.get_logger 'help',      badge
# whisper                   = CND.get_logger 'whisper',   badge
# echo                      = CND.echo.bind CND
# #...........................................................................................................
# types                     = new ( require 'intertype' ).Intertype()
# { isa
#   validate
#   declare
#   type_of }               = types.export()
# { freeze
#   lets }                  = require 'letsfreezethat'
freeze                    = Object.freeze
# if globalThis.require?
#   StateMachine              = require 'javascript-state-machine'
# Mutimix                   = require 'multimix'

# #-----------------------------------------------------------------------------------------------------------
# warn = ( message ) ->
#   if µ?.DOM?.warn?        then µ.DOM.warn message
#   else if console?.warn?  then console.warn message
#   else throw new Error message
#   return null

# #===========================================================================================================
# class Fsm extends Multimix
#   constructor: ( fsmd ) ->
#     # validate.fsmd fsmd

# #===========================================================================================================
# class Compund_fsm extends Multimix
#   constructor: ( fsmds ) ->
#     # validate.fsmds fsmds



#===========================================================================================================
class Intermatic

  #---------------------------------------------------------------------------------------------------------
  constructor: ( fsmd ) ->
    # validate.fsmd fsmd
    @reserved     = freeze [ 'void', 'start', 'stop', 'goto', 'change', 'fail', ]
    @fsmd         = freeze fsmd
    @state        = freeze {}
    @triggers  = {}
    @state        = 'void'
    # @states       = {}
    @before       = {}
    @enter        = {}
    @stay         = {}
    @leave        = {}
    @after        = {}
    @_compile_triggers()
    @_compile_transitioners()
    @_compile_handlers()

  #---------------------------------------------------------------------------------------------------------
  fail: ( trigger ) ->
    throw new Error "^interstate/fail@556^ trigger not allowed: #{rpr trigger}"

  #---------------------------------------------------------------------------------------------------------
  _compile_triggers: ->
    starred = {}
    snames  = new Set [ 'void', ]
    #.......................................................................................................
    for triplet in @fsmd.triggers ? []
      ### TAINT validate.list triplet ###
      ### TAINT validate.tname tname ###
      ### TAINT validate that free of collision ###
      [ from_sname, tname, to_sname, ] = triplet
      #.....................................................................................................
      ### Special-case starred triggers: ###
      if from_sname is '*'
        starred[ tname ] = to_sname
        continue
      #.....................................................................................................
      snames.add from_sname
      snames.add to_sname
      ( @triggers[ tname ] ?= {} )[ from_sname ] = to_sname
    #.......................................................................................................
    for starred_name, to_sname of starred
      for from_sname from snames
        ( @triggers[ starred_name ] ?= {} )[ from_sname ] = to_sname
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_transitioners: ->
    $key = '^trigger'
    for tname, from_and_to_states of @triggers
      do ( tname, from_and_to_states ) =>
        debug '^3334^', [ tname, from_and_to_states, ]
        if @[ tname ]?
          throw new Error "^interstate/_compile_triggers@516^ transitioner #{rpr tname} already defined"
        transitioner = ( P... ) =>
          ### TAINT use single transitioner method for all triggers? ###
          from_sname  = @state
          #-------------------------------------------------------------------------------------------------
          unless ( to_sname = from_and_to_states[ @state ] )?
            trigger = freeze { $key, failed: true, from: from_sname, via: tname, }
            return @fsmd.fail trigger if @fsmd.fail?
            return @fail trigger
          #-------------------------------------------------------------------------------------------------
          ### TAINT rename `trigger` (object w/ data representing the current trajectory) ###
          changed     = to_sname isnt from_sname
          trigger     = freeze { $key, from: from_sname, via: tname, to: to_sname, changed, }
          @before.trigger?          trigger
          @before.change?           trigger if changed
          @before[  tname       ]?  trigger
          @leave[   from_sname  ]?  trigger if changed
          @state      = to_sname if changed
          @stay[    to_sname    ]?  trigger if not changed
          @enter[   to_sname    ]?  trigger if changed
          @after[   tname       ]?  trigger
          @after.change?            trigger if changed
          @after.trigger?           trigger
          return null
        @[ tname ] = transitioner
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_handlers: ->
    ### TAINT add handlers for trigger, change ###
    ### TAINT check names against reserved ###
    for category in [ 'before', 'enter', 'stay', 'leave', 'after', ]
      for name, handler of @fsmd[ category ] ? {}
        @[ category ][ name ] = handler.bind @
    return null

module.exports = { Intermatic, }
# if globalThis.require? then module.exports        = { Intermatic, }
# else                        globalThis.Intermatic = Intermatic



