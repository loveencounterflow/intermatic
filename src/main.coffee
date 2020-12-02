
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
        R =
          _prv_lstates: @_prv_lstates ### !!!!!!!!!!!!! ###
          lstate:   @lstate
          path:     @path
          from:     @from
          via:      @via
          to:       @to
          data:     @data
        R[ subfsm_name ] = @[ subfsm_name ].cstate for subfsm_name in @fsm_names
        return freeze R
    # #-------------------------------------------------------------------------------------------------------
    # from:
    #   get: -> @_prv_lstates[ @_prv_lstates.length - 1 ] ? null
    # #-------------------------------------------------------------------------------------------------------
    # via:
    #   get: -> @_prv_vias[ @_prv_vias.length - 1 ] ? null
    #   set:  ( trigger ) -> @
    # #-------------------------------------------------------------------------------------------------------
    # to:
    #   get: -> '???'
    #-------------------------------------------------------------------------------------------------------
    from:
      get: -> @_prv_lstates[ @_prv_lstates.length - 1 ] ? null
    #-------------------------------------------------------------------------------------------------------
    via:
      get: -> @_prv_vias[ @_prv_vias.length - 1 ] ? null
    #-------------------------------------------------------------------------------------------------------
    to:
      get: -> '???'
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
    for verb, lstates of cyclers
      for cur_lstate, cur_idx in lstates
        nxt_idx     = ( cur_idx + 1 ) %% lstates.length
        nxt_lstate  = lstates[ nxt_idx ]
        triggers.push [ cur_lstate, verb, nxt_lstate, ]
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
      ### TAINT validate.verb verb ###
      ### TAINT validate that free of collision ###
      [ departure, verb, destination, ] = triplet
      #.....................................................................................................
      ### TAINT also validate that tuples [ departure, verb, ] unique ###
      if verb is 'start'
        throw new Error "^interstate/fail@556^ duplica declaration of `start`: #{rpr triplet}" if has_start
        has_start     = true
        @starts_with  = destination
      #.....................................................................................................
      ### Special-case starred triggers: ###
      if departure is '*'
        starred[ verb ] = destination
        continue
      #.....................................................................................................
      lstates.add departure
      lstates.add destination
      set ( @triggers[ verb ] ?= {} ), departure, destination
    #.......................................................................................................
    for starred_name, destination of starred
      for departure from lstates
        set ( @triggers[ starred_name ] ?= {} ), departure, destination
    #.......................................................................................................
    @lstates = freeze [ lstates..., ]
    return null

  #---------------------------------------------------------------------------------------------------------
  _new_tid: -> tid = ++@constructor._tid; return "t#{tid}"

  #---------------------------------------------------------------------------------------------------------
  _get_transitioner: ( verb, destinations_by_departures = null ) ->
    ### TAINT too much logic to be done at in run time, try to precompile more ###
    return transitioner = ( P... ) =>
      ### TAINT use single transitioner method for all triggers? ###
      departure   = @lstate
      id          = @_new_tid()
      #-------------------------------------------------------------------------------------------------
      if destinations_by_departures?
        unless ( destination = destinations_by_departures[ departure ] )?
          trigger = freeze { id, failed: true, from: departure, via: verb, }
          return @fail trigger
      else
        [ destination, P..., ] = P
      #-------------------------------------------------------------------------------------------------
      changed         = destination isnt departure
      trigger         = { id, from: departure, via: verb, to: destination, }
      trigger.changed = true if changed
      trigger         = freeze trigger
      ### TAINT add extra arguments P ###
      @before.any?              trigger
      @before.change?           trigger if changed
      @before[ verb        ]?  trigger
      @leave.any?               trigger if changed
      @leave[  departure  ]?  trigger if changed
      @lstate = destination if changed
      @stay.any?                trigger if not changed
      @stay[   destination    ]?  trigger if not changed
      @enter.any?               trigger if changed
      @enter[  destination    ]?  trigger if changed
      @after[  verb        ]?  trigger
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
    for verb, destinations_by_departures of @triggers
      do ( verb, destinations_by_departures ) =>
        ### NOTE we *could* allow custom transitioners but that would only replicate behavior available
        via `fsm.before[ verb ]()`, `fsm.after[ verb ]()`:
        transitioner = @_tmp.fsmd[ verb ] ? @_get_transitioner verb, destinations_by_departures ###
        transitioner = @_get_transitioner verb, destinations_by_departures
        set @, verb, transitioner
        @_tmp.known_names.add verb
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_handlers: ->
    ### TAINT add handlers for trigger, change ###
    ### TAINT check names against reserved ###
    try
      for category in [ 'before', 'enter', 'stay', 'leave', 'after', ]
        @_tmp.known_names.add category
        for name, handler of @_tmp.fsmd[ category ] ? {}
          @[ category ][ name ] = handler.bind @
    catch error
      error.message += " — Error occurred during @_compile_handlers with #{rpr { category, name, handler, }}"
      throw error
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_goto: ->
    @_tmp.known_names.add 'goto'
    if ( goto = @_tmp.fsmd.goto )?
      unless goto is '*'
        throw new Error "^interstate/_compile_handlers@776^ expected '*' for key `goto`, got #{rpr goto}"
      transitioner = @_get_transitioner 'goto', null
      goto = ( destination, P... ) => transitioner destination, P...
      for destination in @lstates
        goto[ destination ] = ( P... ) => transitioner destination, P...
      set @, 'goto', goto
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_can: ->
    @_tmp.known_names.add 'can'
    can = ( verb ) =>
      unless ( trigger = @triggers[ verb ] )?
        throw new Error "^interstate/can@822^ unknown trigger #{rpr verb}"
      return trigger[ @lstate ]?
    for verb of @triggers
      can[ verb ] = ( P... ) => can verb, P...
    set @, 'can', can
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_tryto: ->
    @_tmp.known_names.add 'tryto'
    tryto = ( verb, P... ) =>
      return false unless @can verb
      ### TAINT we will possibly want to return some kind of result from trigger ###
      @[ verb ] P...
      return true
    for verb of @triggers
      tryto[ verb ] = ( P... ) => tryto verb, P...
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



