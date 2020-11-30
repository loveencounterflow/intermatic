
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
  @_tid: 0

  #---------------------------------------------------------------------------------------------------------
  # constructor: ( fname, fsmd ) ->
  constructor: ( fsmd ) ->

    # validate.fsmd fsmd
    @_covered_names = new Set()
    @reserved       = freeze [ 'void', 'start', 'stop', 'goto', 'change', 'fail', ]
    @fsmd           = { fsmd..., }
    @triggers       = {}
    @subfsm_names   = []
    @has_subfsms    = false
    @_lstate        = 'void'
    # @states         = {}
    @before         = {}
    @enter          = {}
    @stay           = {}
    @leave          = {}
    @after          = {}
    @up             = null
    @_compile_cyclers()
    @_compile_triggers()
    @_compile_transitioners()
    @_compile_handlers()
    @_compile_goto()
    @_compile_subfsms()
    @_copy_other_attributes()
    delete @_covered_names
    return null

  #---------------------------------------------------------------------------------------------------------
  Object.defineProperties @prototype,
    #-------------------------------------------------------------------------------------------------------
    lstate:
      get:            -> @_lstate
      set: ( lstate ) ->
        if typeof lstate isnt 'string'
          throw new Error "^interstate/set/lstate@501^ lstate name must be text, got #{rpr lstate}"
        @_lstate = lstate
    #-------------------------------------------------------------------------------------------------------
    cstate:
      get: ->
        return @lstate unless @has_subfsms
        R = { _: @lstate, }
        R[ subfsm_name ] = @[ subfsm_name ].cstate for subfsm_name in @subfsm_names
        return freeze R

  #---------------------------------------------------------------------------------------------------------
  fail: ( trigger ) ->
    throw new Error "^interstate/fail@556^ trigger not allowed: #{rpr trigger}"

  #---------------------------------------------------------------------------------------------------------
  _compile_cyclers: ->
    triggers = @fsmd.triggers = [ ( @fsmd.triggers ? [] )..., ]
    return null unless ( cyclers = @fsmd.cyclers )?
    #.......................................................................................................
    for tname, lstates of cyclers
      debug '^33398^', lstates
      for cur_lstate, cur_idx in lstates
        nxt_idx     = ( cur_idx + 1 ) %% lstates.length
        nxt_lstate  = lstates[ nxt_idx ]
        triggers.push [ cur_lstate, tname, nxt_lstate, ]
    #.......................................................................................................
    freeze @fsmd
    debug '^222233^', @fsmd
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_triggers: ->
    has_start     = false
    @starts_with  = null
    starred       = {}
    lstates       = new Set [ 'void', ]
    triggers      = @fsmd.triggers ### already a copy at this point, see @_compile_cyclers ###
    tnames        = new Set ( t[ 1 ] for t in triggers )
    #.......................................................................................................
    unless tnames.has 'start'
      first_lstate = triggers[ 0 ]?[ 2 ] ? 'void'
      triggers.unshift [ 'void', 'start', first_lstate, ]
    #.......................................................................................................
    for triplet in triggers
      ### TAINT validate.list_of.list triplet ###
      ### TAINT validate.tname tname ###
      ### TAINT validate that free of collision ###
      [ from_lstate, tname, to_lstate, ] = triplet
      #.....................................................................................................
      ### TAINT also validate that tuples [ from_lstate, tname, ] unique ###
      if tname is 'start'
        throw new Error "^interstate/fail@556^ duplica declaration of `start`: #{rpr triplet}" if has_start
        has_start     = true
        @starts_with  = to_lstate
      #.....................................................................................................
      ### Special-case starred triggers: ###
      if from_lstate is '*'
        starred[ tname ] = to_lstate
        continue
      #.....................................................................................................
      lstates.add from_lstate
      lstates.add to_lstate
      set ( @triggers[ tname ] ?= {} ), from_lstate, to_lstate
    #.......................................................................................................
    for starred_name, to_lstate of starred
      for from_lstate from lstates
        set ( @triggers[ starred_name ] ?= {} ), from_lstate, to_lstate
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  _new_tid: -> tid = ++@constructor._tid; return "t#{tid}"

  #---------------------------------------------------------------------------------------------------------
  _get_transitioner: ( tname, from_and_to_lstates = null ) ->
    ### TAINT too much logic to be done at in run time, try to precompile more ###
    $key = '^trigger'
    return transitioner = ( P... ) =>
      ### TAINT use single transitioner method for all triggers? ###
      from_lstate = @lstate
      id          = @_new_tid()
      #-------------------------------------------------------------------------------------------------
      if from_and_to_lstates?
        unless ( to_lstate = from_and_to_lstates[ @lstate ] )?
          trigger = freeze { $key, id, failed: true, from: from_lstate, via: tname, }
          return @fsmd.fail trigger if @fsmd.fail?
          return @fail trigger
      else
        [ to_lstate, P..., ] = P
      #-------------------------------------------------------------------------------------------------
      changed     = to_lstate isnt from_lstate
      trigger     = freeze { $key, id, from: from_lstate, via: tname, to: to_lstate, changed, }
      ### TAINT add extra arguments P ###
      @before.trigger?          trigger
      @before.change?           trigger if changed
      @before[ tname        ]?  trigger
      @leave[  from_lstate  ]?  trigger if changed
      @lstate     = to_lstate if changed
      @stay[   to_lstate    ]?  trigger if not changed
      @enter[  to_lstate    ]?  trigger if changed
      @after[  tname        ]?  trigger
      @after.change?            trigger if changed
      @after.trigger?           trigger
      return null

  #---------------------------------------------------------------------------------------------------------
  _compile_transitioners: ->
    @_covered_names.add 'triggers'
    for tname, from_and_to_lstates of @triggers
      do ( tname, from_and_to_lstates ) =>
        ### NOTE we *could* allow custom transitioners but that would only replicate behavior available
        via `fsm.before[ tname ]()`, `fsm.after[ tname ]()`:
        transitioner = @fsmd[ tname ] ? @_get_transitioner tname, from_and_to_lstates ###
        transitioner = @_get_transitioner tname, from_and_to_lstates
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
      set @, 'goto', ( to_lstate ) =>
        transitioner to_lstate
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_subfsms: ->
    @_covered_names.add 'subs'
    subfsm_names = []
    for sub_fname, sub_fsmd of @fsmd.subs ? {}
      sub_fsmd  = { sub_fsmd..., }
      if sub_fsmd.name? and sub_fsmd.name isnt sub_fname
        throw new Error "^interstate/_compile_subfsms@506^ name mismatch, got #{rpr sub_fname}, #{rpr sub_fsmd.name}"
      sub_fsmd.name = sub_fname
      set sub_fsmd, 'up', @
      @_covered_names.add sub_fname
      subfsm_names.push   sub_fname
      set @, sub_fname, new @constructor sub_fsmd
    @subfsm_names = freeze subfsm_names
    @has_subfsms  = subfsm_names.length > 0
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



