
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

unless globalThis.debug?  then debug  = console.debug
unless globalThis.rpr?    then rpr    = JSON.stringify

#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
set = ( target, key, value ) ->
  if target[ key ]?
    throw new Error "^interstate/set@776^ name collision: #{rpr key}"
  target[ key ] = value
  return value


#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
class Intermatic

  #---------------------------------------------------------------------------------------------------------
  # constructor: ( fname, fsmd ) ->
  constructor: ( fsmd ) ->

    # validate.fsmd fsmd
    @_covered_names = new Set()
    @reserved       = freeze [ 'void', 'start', 'stop', 'goto', 'change', 'fail', ]
    @fsmd           = freeze fsmd
    @triggers       = {}
    @_state         = 'void'
    # @states         = {}
    @before         = {}
    @enter          = {}
    @stay           = {}
    @leave          = {}
    @after          = {}
    @my             = {}
    @up             = null
    @_compile_triggers()
    @_compile_transitioners()
    @_compile_handlers()
    @_compile_goto()
    @_compile_subfsms()
    @_copy_other_attributes()

  #---------------------------------------------------------------------------------------------------------
  Object.defineProperties @prototype,
    state:
      get:            -> @_state
      set: ( sname  ) ->
        if typeof sname isnt 'string'
          throw new Error "^interstate/set/state@501^ state name must be text, got #{rpr sname}"
        @_state = sname

  #---------------------------------------------------------------------------------------------------------
  fail: ( trigger ) ->
    throw new Error "^interstate/fail@556^ trigger not allowed: #{rpr trigger}"

  #---------------------------------------------------------------------------------------------------------
  _compile_triggers: ->
    has_start     = false
    @starts_with  = null
    starred       = {}
    snames        = new Set [ 'void', ]
    triggers      = [ ( @fsmd.triggers ? [] )..., ]
    tnames        = new Set ( t[ 1 ] for t in triggers )
    #.......................................................................................................
    unless tnames.has 'start'
      first_sname = triggers[ 0 ]?[ 2 ] ? 'void'
      triggers.unshift [ 'void', 'start', first_sname, ]
    #.......................................................................................................
    for triplet in triggers
      ### TAINT validate.list_of.list triplet ###
      ### TAINT validate.tname tname ###
      ### TAINT validate that free of collision ###
      [ from_sname, tname, to_sname, ] = triplet
      #.....................................................................................................
      ### TAINT also validate that tuples [ from_sname, tname, ] unique ###
      if tname is 'start'
        throw new Error "^interstate/fail@556^ duplica declaration of `start`: #{rpr triplet}" if has_start
        has_start     = true
        @starts_with  = to_sname
      #.....................................................................................................
      ### Special-case starred triggers: ###
      if from_sname is '*'
        starred[ tname ] = to_sname
        continue
      #.....................................................................................................
      snames.add from_sname
      snames.add to_sname
      set ( @triggers[ tname ] ?= {} ), from_sname, to_sname
    #.......................................................................................................
    for starred_name, to_sname of starred
      for from_sname from snames
        set ( @triggers[ starred_name ] ?= {} ), from_sname, to_sname
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  _get_transitioner: ( tname, from_and_to_states = null ) ->
    ### TAINT too much logic to be done at in run time, try to precompile more ###
    $key = '^trigger'
    return transitioner = ( P... ) =>
      ### TAINT use single transitioner method for all triggers? ###
      from_sname  = @state
      #-------------------------------------------------------------------------------------------------
      if from_and_to_states?
        unless ( to_sname = from_and_to_states[ @state ] )?
          trigger = freeze { $key, failed: true, from: from_sname, via: tname, }
          return @fsmd.fail trigger if @fsmd.fail?
          return @fail trigger
      else
        [ to_sname, P..., ] = P
      #-------------------------------------------------------------------------------------------------
      changed     = to_sname isnt from_sname
      trigger     = freeze { $key, from: from_sname, via: tname, to: to_sname, changed, }
      ### TAINT add extra arguments P ###
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

  #---------------------------------------------------------------------------------------------------------
  _compile_transitioners: ->
    @_covered_names.add 'triggers'
    for tname, from_and_to_states of @triggers
      do ( tname, from_and_to_states ) =>
        ### NOTE we *could* allow custom transitioners but that would only replicate behavior available
        via `fsm.before[ tname ]()`, `fsm.after[ tname ]()`:
        transitioner = @fsmd[ tname ] ? @_get_transitioner tname, from_and_to_states ###
        transitioner = @_get_transitioner tname, from_and_to_states
        set @, tname, transitioner
        @_covered_names.add tname
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_handlers: ->
    ### TAINT add handlers for trigger, change ###
    ### TAINT check names against reserved ###
    for category in [ 'before', 'enter', 'stay', 'leave', 'after', ]
      @_covered_names.add category
      for name, handler of @fsmd[ category ] ? {}
        @[ category ][ name ] = handler.bind @
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_goto: ->
    @_covered_names.add 'goto'
    if ( goto = @fsmd.goto )?
      unless goto is '*'
        throw new Error "^interstate/_compile_handlers@776^ expected '*' for key `goto`, got #{rpr goto}"
      transitioner = @_get_transitioner 'goto', null
      set @, 'goto', ( to_sname ) =>
        transitioner to_sname
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_subfsms: ->
    @_covered_names.add 'my'
    return null unless @fsmd.my?
    for sub_fname, sub_fsmd of @fsmd.my
      sub_fsmd  = { sub_fsmd..., }
      if sub_fsmd.name? and sub_fsmd.name isnt sub_fname
        throw new Error "^interstate/_compile_subfsms@506^ name mismatch, got #{rpr sub_fname}, #{rpr sub_fsmd.name}"
      sub_fsmd.name     = sub_fname
      set sub_fsmd, 'up', @
      @my[ sub_fname ]  = new @constructor sub_fsmd
      # debug '^4444^', @fsmd.my
    return null

  #---------------------------------------------------------------------------------------------------------
  _copy_other_attributes: ->
    for pname, propd of Object.getOwnPropertyDescriptors @fsmd
      continue if @_covered_names.has pname
      Object.defineProperty @, pname, propd
    return null

############################################################################################################
module.exports = Intermatic
# if globalThis.require? then module.exports        = { Intermatic, }
# else                        globalThis.Intermatic = Intermatic



