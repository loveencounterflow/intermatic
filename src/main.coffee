
'use strict'


############################################################################################################
freeze                    = Object.freeze
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

#-----------------------------------------------------------------------------------------------------------
push_circular = ( xs, x, max_length = 1 ) ->
  R = [ xs..., x, ]
  R.shift() while R.length > max_length
  return freeze R


#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
class Intermatic

  #---------------------------------------------------------------------------------------------------------
  @_tid: 0

  #---------------------------------------------------------------------------------------------------------
  constructor: ( fsmd ) ->
    # validate.fsmd fsmd
    @_tmp               = {}
    @_tmp.fsmd          = { fsmd..., }
    @_tmp.known_names   = new Set()
    @triggers           = {}
    @lstates            = null
    @fsm_names          = []
    @has_subfsms        = false
    @_lstate            = 'void'
    @before             = {}
    @enter              = {}
    @stay               = {}
    @leave              = {}
    @after              = {}
    @data               = {}
    @history_length     = 3
    @_prv_lstates       = []
    @_prv_vias          = []
    @_nxt_via           = null
    @_nxt_destination   = null
    @up                 = null
    @_path              = null
    @_compile_fail()
    @_compile_cyclers()
    @_compile_triggers()
    @_compile_transitioners()
    @_compile_handlers()
    @_compile_goto()
    @_compile_can()
    @_compile_tryto()
    @_compile_subfsms()
    @_compile_data()
    @_copy_other_attributes()
    delete @_tmp
    return null

  #---------------------------------------------------------------------------------------------------------
  Object.defineProperties @prototype,
    #-------------------------------------------------------------------------------------------------------
    lstate:
      get:            -> @_lstate
      set: ( lstate ) ->
        if typeof lstate isnt 'string'
          throw new Error "^interstate/set/lstate@501^ lstate name must be text, got #{rpr lstate}"
        @_prv_lstates = push_circular @_prv_lstates, lstate, @history_length
        @_lstate      = lstate
    #-------------------------------------------------------------------------------------------------------
    cstate:
      get: ->
        return @lstate unless @has_subfsms
        R = { _: @lstate, }
        R[ subfsm_name ] = @[ subfsm_name ].cstate for subfsm_name in @fsm_names
        return freeze R
    #-------------------------------------------------------------------------------------------------------
    fsms:
      get: -> ( @[ subfsm_name ] for subfsm_name in @fsm_names )
    #-------------------------------------------------------------------------------------------------------
    path:
      get: ->
        return R if ( R = @_path )?
        return @_path = if @up? then "#{@up.path}/#{@name}" else @name

  #---------------------------------------------------------------------------------------------------------
  fail: ( trigger ) ->
    throw new Error "^interstate/fail@556^ trigger not allowed: (#{rpr @name}) #{rpr trigger}"

  #---------------------------------------------------------------------------------------------------------
  _compile_fail: ->
    @_tmp.known_names.add 'fail'
    return null unless ( fail = @_tmp.fsmd.fail )?
    @fail = fail.bind @
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_cyclers: ->
    @_tmp.known_names.add 'cyclers'
    triggers = @_tmp.fsmd.triggers = [ ( @_tmp.fsmd.triggers ? [] )..., ]
    return null unless ( cyclers = @_tmp.fsmd.cyclers )?
    #.......................................................................................................
    for tname, lstates of cyclers
      for cur_lstate, cur_idx in lstates
        nxt_idx     = ( cur_idx + 1 ) %% lstates.length
        nxt_lstate  = lstates[ nxt_idx ]
        triggers.push [ cur_lstate, tname, nxt_lstate, ]
    #.......................................................................................................
    # freeze @_tmp.fsmd
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_triggers: ->
    has_start     = false
    @starts_with  = null
    starred       = {}
    lstates       = new Set [ 'void', ]
    triggers      = @_tmp.fsmd.triggers ### already a copy at this point, see @_compile_cyclers ###
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
    @lstates = freeze [ lstates..., ]
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
          return @fail trigger
      else
        [ to_lstate, P..., ] = P
      #-------------------------------------------------------------------------------------------------
      changed     = to_lstate isnt from_lstate
      trigger     = freeze { $key, id, from: from_lstate, via: tname, to: to_lstate, changed, }
      ### TAINT add extra arguments P ###
      @before.any?              trigger
      @before.change?           trigger if changed
      @before[ tname        ]?  trigger
      @leave.any?               trigger if changed
      @leave[  from_lstate  ]?  trigger if changed
      @lstate = to_lstate if changed
      @stay.any?                trigger if not changed
      @stay[   to_lstate    ]?  trigger if not changed
      @enter.any?               trigger if changed
      @enter[  to_lstate    ]?  trigger if changed
      @after[  tname        ]?  trigger
      @after.change?            trigger if changed
      @after.any?               trigger
      # if @up?.after.cchange?
      #   debug '^3338398^', @up?.after.cchange, trigger
      #   @up.after.cchange trigger
      # @up?.after.cchange?       trigger if changed
      return null

  #---------------------------------------------------------------------------------------------------------
  _compile_transitioners: ->
    @_tmp.known_names.add 'triggers'
    for tname, from_and_to_lstates of @triggers
      do ( tname, from_and_to_lstates ) =>
        ### NOTE we *could* allow custom transitioners but that would only replicate behavior available
        via `fsm.before[ tname ]()`, `fsm.after[ tname ]()`:
        transitioner = @_tmp.fsmd[ tname ] ? @_get_transitioner tname, from_and_to_lstates ###
        transitioner = @_get_transitioner tname, from_and_to_lstates
        set @, tname, transitioner
        @_tmp.known_names.add tname
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_handlers: ->
    ### TAINT add handlers for trigger, change ###
    ### TAINT check names against reserved ###
    for category in [ 'before', 'enter', 'stay', 'leave', 'after', ]
      @_tmp.known_names.add category
      for name, handler of @_tmp.fsmd[ category ] ? {}
        @[ category ][ name ] = handler.bind @
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_goto: ->
    @_tmp.known_names.add 'goto'
    if ( goto = @_tmp.fsmd.goto )?
      unless goto is '*'
        throw new Error "^interstate/_compile_handlers@776^ expected '*' for key `goto`, got #{rpr goto}"
      transitioner = @_get_transitioner 'goto', null
      goto = ( to_lstate, P... ) => transitioner to_lstate, P...
      for to_lstate in @lstates
        goto[ to_lstate ] = ( P... ) => transitioner to_lstate, P...
      set @, 'goto', goto
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_can: ->
    @_tmp.known_names.add 'can'
    can = ( tname ) =>
      unless ( trigger = @triggers[ tname ] )?
        throw new Error "^interstate/can@822^ unknown trigger #{rpr tname}"
      return trigger[ @lstate ]?
    for tname of @triggers
      can[ tname ] = ( P... ) => can tname, P...
    set @, 'can', can
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_tryto: ->
    @_tmp.known_names.add 'tryto'
    tryto = ( tname, P... ) =>
      return false unless @can tname
      ### TAINT we will possibly want to return some kind of result from trigger ###
      @[ tname ] P...
      return true
    for tname of @triggers
      tryto[ tname ] = ( P... ) => tryto tname, P...
    set @, 'tryto', tryto
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_subfsms: ->
    @_tmp.known_names.add 'fsms'
    fsm_names = []
    for sub_fname, sub_fsmd of @_tmp.fsmd.fsms ? {}
      sub_fsmd  = { sub_fsmd..., }
      if sub_fsmd.name? and sub_fsmd.name isnt sub_fname
        throw new Error "^interstate/_compile_subfsms@506^ name mismatch, got #{rpr sub_fname}, #{rpr sub_fsmd.name}"
      sub_fsmd.name = sub_fname
      set sub_fsmd, 'up', @
      @_tmp.known_names.add sub_fname
      fsm_names.push   sub_fname
      set @, sub_fname, new @constructor sub_fsmd
    @fsm_names    = freeze fsm_names
    @has_subfsms  = fsm_names.length > 0
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_data: ->
    @_tmp.known_names.add 'data'
    return null unless ( data = @_tmp.fsmd.data )?
    for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd.data
      Object.defineProperty @data, pname, propd
    return null

  #---------------------------------------------------------------------------------------------------------
  _copy_other_attributes: ->
    for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd
      continue if @_tmp.known_names.has pname
      Object.defineProperty @, pname, propd
    return null


############################################################################################################
module.exports = Intermatic
# if globalThis.require? then module.exports        = { Intermatic, }
# else                        globalThis.Intermatic = Intermatic



