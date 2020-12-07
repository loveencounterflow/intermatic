
'use strict'


############################################################################################################
types                     = new ( require 'intertype' ).Intertype()
{ validate
  isa
  declare }               = types.export()
freeze                    = Object.freeze
unless globalThis.debug?  then debug  = console.debug
unless globalThis.rpr?    then rpr    = JSON.stringify

#===========================================================================================================
# TYPES
#-----------------------------------------------------------------------------------------------------------
declare 'trajectory', tests:
  "x isa list of texts":      ( x ) -> @isa.list_of 'text', x
  "length is 0 or > 1":       ( x ) -> ( x.length is 0 ) or ( x.length > 1 )

#-----------------------------------------------------------------------------------------------------------
declare 'verb', tests:
  "x isa nonempty_text":      ( x ) -> @isa.nonempty_text x
  # "x is not a reserved word": ( x ) ->
  # "x is not an lstate": ( x ) ->
  # or test against catalog of known verbs

#-----------------------------------------------------------------------------------------------------------
declare 'lstate', tests:
  "x isa nonempty_text":      ( x ) -> @isa.nonempty_text x
  # "x is not a reserved word": ( x ) ->
  # "x is not an verb": ( x ) ->
  # or test against catalog of known verbs

#-----------------------------------------------------------------------------------------------------------
declare 'actions', tests:
  ### TAINT allow async functions ###
  "x isa list of functions":      ( x ) -> @isa.list_of 'function', x


#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
set = ( target, key, value ) ->
  if target[ key ] isnt undefined
    throw new Error "^intermatic/set@776^ name collision: #{rpr key}"
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
    @moves              = {}
    @cascades           = null
    @lstates            = null
    @fsm_names          = []
    @has_subfsms        = false
    @_lstate            = 'void'
    @trigger_actions    = freeze [ 'before', 'after', ]
    @state_actions      = freeze [ 'enter', 'leave', 'stay', ]
    @data               = null
    @history_length     = 1
    @_prv_lstates       = [ @_lstate, ]
    @_prv_verbs         = []
    @_nxt_dpar          = null
    @_nxt_dest          = null
    @_nxt_verb          = null
    @up                 = null
    @_path              = null
    @_compile_fail()
    # @_compile_cyclers()
    @_compile_moves()
    @_compile_transitioners()
    # @_compile_handlers()
    # @_compile_goto()
    # @_compile_can()
    # @_compile_tryto()
    # @_compile_subfsms()
    # @_compile_data()
    # @_compile_cascades()
    # @_copy_other_attributes()
    delete @_tmp
    return null

  #---------------------------------------------------------------------------------------------------------
  Object.defineProperties @prototype,
    #-------------------------------------------------------------------------------------------------------
    lstate:
      get:            -> @_lstate
      set: ( lstate ) ->
        if typeof lstate isnt 'string'
          throw new Error "^intermatic/set/lstate@501^ lstate name must be text, got #{rpr lstate}"
        @_prv_lstates = push_circular @_prv_lstates, lstate, @history_length + 1
        @_lstate      = lstate
    #-------------------------------------------------------------------------------------------------------
    cstate:
      get: ->
        R                 = {}
        R.path            = @path
        R.lstate          = @lstate
        R.verb            = x if ( x = @verb    )?
        R.dpar            = x if ( x = @dpar    )?
        R.dest            = x if ( x = @dest    )?
        R.changed         = x if ( x = @changed )? and x
        R.failed          = true if ( @dpar? and not @dest? )
        R.data            = freeze { x..., } if ( x = @data )?
        R[ subfsm_name ]  = @[ subfsm_name ].cstate for subfsm_name in @fsm_names
        return freeze R
    #-------------------------------------------------------------------------------------------------------
    EXP_cstate:
      get: ->
        R                 = {}
        R.lstate          = @lstate
        R.data            = freeze { x..., } if ( x = @data )?
        R[ subfsm_name ]  = @[ subfsm_name ].EXP_cstate for subfsm_name in @fsm_names
        return freeze R
    #-------------------------------------------------------------------------------------------------------
    EXP_dstate:
      get: ->
        target        = { lstate: @lstate, }
        R             = { [@name]: target, }
        target.data   = @data if @data?
        for subfsm_name in @fsm_names
          sub_fsm = @[ subfsm_name ]
          Object.assign target, sub_fsm.EXP_dstate
        freeze target
        return freeze R
    #-------------------------------------------------------------------------------------------------------
    dpar: get: -> @_nxt_dpar
    dest: get: -> @_nxt_dest
    verb: get: -> @_nxt_verb
    move: get: -> freeze { verb: @verb, dpar: @dpar, dest:@dest, }
    fsms: get: -> ( @[ subfsm_name ] for subfsm_name in @fsm_names )
    #-------------------------------------------------------------------------------------------------------
    changed:
      get: ->
        return null unless @_nxt_dpar? and @_nxt_dest?
        return @_nxt_dpar isnt @_nxt_dest
    #-------------------------------------------------------------------------------------------------------
    path:
      get: ->
        return R if ( R = @_path )?
        return @_path = if @up? then "#{@up.path}/#{@name}" else @name
    #-------------------------------------------------------------------------------------------------------
    history:
      get: ->
        R = []
        for verb, idx in @_prv_verbs
          dpar  = @_prv_lstates[ idx ]
          dest  = @_prv_lstates[ idx + 1 ]
          R.push freeze { verb, dpar, dest, }
        return freeze R

  #---------------------------------------------------------------------------------------------------------
  fail: ->
    throw new Error "^intermatic/fail@557^ trigger not allowed: #{rpr { name: @name, verb: @verb, dpar: @dpar, }}"

  #---------------------------------------------------------------------------------------------------------
  _compile_fail: ->
    @_tmp.known_names.add 'fail'
    return null unless ( fail = @_tmp.fsmd.fail )?
    @fail = fail.bind @
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_moves: ->
    starred       = {}
    lstates       = new Set [ 'void', ]
    moves         = @_tmp.fsmd.moves = { ( @_tmp.fsmd.moves ? {} )..., }
    verbs         = ( verb for verb of moves )
    #.......................................................................................................
    unless moves.start?
      ### TAINT validate.nonempty_text moves.start ###
      ### TAINT validate.nonempty_list verbs ###
      ### TAINT validate.nonempty_list moves[ verbs[ 0 ] ][ 0 ] ###
      first_lstate  = moves[ verbs[ 0 ] ][ 0 ] ? 'void'
      moves.start   = [ 'void', first_lstate, ]
    #.......................................................................................................
    for verb, trajectory of moves
      #.....................................................................................................
      ### If the verb is `start`, then value may be just the name of the start verb instead of a list ###
      ### TAINT validate.nonempty_text trajectory ###
      if ( verb is 'start' ) and ( typeof trajectory is 'string' )
        trajectory = [ 'void', trajectory, ]
      #.....................................................................................................
      for tidx in [ 0 ... trajectory.length - 1 ]
        ### TAINT validate.list_of.list triplet ###
        ### TAINT validate.verb verb ###
        ### TAINT validate that free of collision ###
        dpar  = trajectory[ tidx ]
        dest  = trajectory[ tidx + 1 ]
        #...................................................................................................
        lstates.add dpar
        lstates.add dest
        set ( @moves[ verb ] ?= {} ), dpar, dest
    #.......................................................................................................
    @lstates = freeze [ lstates..., ]
    return null

  #---------------------------------------------------------------------------------------------------------
  _compile_transitioners: ->
    @_tmp.known_names.add 'moves'
    for verb, dests_by_deps of @moves
      do ( verb, dests_by_deps ) =>
        transitioner = @_get_transitioner verb, dests_by_deps
        ### Attach lifecycle handlers to transitioner such that `fsmd[verb].before` becomes
        `fsm[verb].before` and so on: ###
        for lifecycle, handlers of ( @_tmp.fsmd[ verb ] ? {} )
          handlers = [ handlers, ] unless ( Array.isArray handlers )
          set transitioner, lifecycle, handlers
        set @, verb, transitioner
        @_tmp.known_names.add verb
    return null

  #---------------------------------------------------------------------------------------------------------
  _get_transitioner: ( verb, dests_by_deps = null ) ->
    ### TAINT add extra arguments P ###
    ### TAINT too much logic to be done at in run time, try to precompile more ###
    return transitioner = ( P... ) =>
      ### TAINT use single transitioner method for all triggers? ###
      @_nxt_verb      = verb
      ### TAINT consider to do this inside a property setter, as for `@lstate`: ###
      @_prv_verbs     = push_circular @_prv_verbs, verb, @history_length
      @_nxt_dpar      = dpar = @lstate
      # id              = @_new_tid()
      #-------------------------------------------------------------------------------------------------
      # if not dests_by_deps?
      #   debug '^374873^', verb, P
      if dests_by_deps? then    dest          = ( dests_by_deps[ dpar ] ? null )
      else                    [ dest, P..., ] = P
      return @fail P... unless dest?
      @_nxt_dest = dest
      #.....................................................................................................
      changed                   = dest isnt dpar
      #.....................................................................................................
      if @cascades and @cascades.has verb
        for subfsm_name in @fsm_names
          @[ subfsm_name ].tryto verb, P...
      #.....................................................................................................
      # for aname, actions of @before
      #   continue unless ( aname is 'any' ) or ( aname is XXXX )
      #   for action in actions
      #     XXXXX
      debug '^333344^', { verb, dpar, dest, changed, }
      debug '^333344^', @[ verb ]
      debug '^333344^', @[ verb ]?.before
      # @before.any?              P...
      # @before.change?           P... if changed
      call_handlers = ( handlers, P... ) =>
        return null unless handlers?
        handler.apply @, P for handler in handlers
        return null
      call_handlers @[ verb ]?.before, P...
      # #.....................................................................................................
      # @leave.any?               P... if changed
      # @leave[ dpar ]?           P... if changed
      # #.....................................................................................................
      # @lstate = dest if changed
      # #.....................................................................................................
      # @stay.any?                P... if not changed
      # @stay[ dest ]?            P... if not changed
      # @enter.any?               P... if changed
      # @enter[ dest ]?           P... if changed
      # #.....................................................................................................
      # @after[ verb ]?           P...
      # @after.change?            P... if changed
      # @after.any?               P...
      #.....................................................................................................
      ### NOTE At this point, the transition has finished, so we reset the `@_nxt_*` attributes: ###
      @_nxt_verb                = null
      @_nxt_dest                = null
      @_nxt_dpar                = null
      #.....................................................................................................
      return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_handlers: ->
  #   ### TAINT add handlers for trigger, change ###
  #   ### TAINT check names against reserved ###
  #   try
  #     for category in [ 'before', 'enter', 'stay', 'leave', 'after', ]
  #       @_tmp.known_names.add category
  #       for name, handler of @_tmp.fsmd[ category ] ? {}
  #         @[ category ][ name ] = handler.bind @
  #   catch error
  #     error.message += " — Error occurred during @_compile_handlers with #{rpr { category, name, handler, }}"
  #     throw error
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_goto: ->
  #   @_tmp.known_names.add 'goto'
  #   if ( goto = @_tmp.fsmd.goto )?
  #     unless goto is '*'
  #       throw new Error "^intermatic/_compile_handlers@776^ expected '*' for key `goto`, got #{rpr goto}"
  #     transitioner  = @_get_transitioner 'goto', null
  #     goto          = ( dest, P... ) => transitioner dest, P...
  #     for dest in @lstates
  #       do ( dest ) =>
  #         goto[ dest ] = ( P... ) => transitioner dest, P...
  #     set @, 'goto', goto
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_can: ->
  #   @_tmp.known_names.add 'can'
  #   can = ( verb ) =>
  #     unless ( trigger = @triggers[ verb ] )?
  #       throw new Error "^intermatic/can@822^ unknown trigger #{rpr verb}"
  #     return trigger[ @lstate ]?
  #   for verb of @triggers
  #     do ( verb ) =>
  #       can[ verb ] = ( P... ) => can verb, P...
  #   set @, 'can', can
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_tryto: ->
  #   @_tmp.known_names.add 'tryto'
  #   tryto = ( verb, P... ) =>
  #     return false unless @can verb
  #     ### TAINT we will possibly want to return some kind of result from trigger ###
  #     @[ verb ] P...
  #     return true
  #   for verb of @triggers
  #     do ( verb ) =>
  #       tryto[ verb ] = ( P... ) => tryto verb, P...
  #   set @, 'tryto', tryto
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_subfsms: ->
  #   @_tmp.known_names.add 'fsms'
  #   fsm_names = []
  #   for sub_fname, sub_fsmd of @_tmp.fsmd.fsms ? {}
  #     sub_fsmd  = { sub_fsmd..., }
  #     if sub_fsmd.name? and sub_fsmd.name isnt sub_fname
  #       throw new Error "^intermatic/_compile_subfsms@506^ name mismatch, got #{rpr sub_fname}, #{rpr sub_fsmd.name}"
  #     sub_fsmd.name = sub_fname
  #     set sub_fsmd, 'up', @
  #     @_tmp.known_names.add sub_fname
  #     fsm_names.push   sub_fname
  #     set @, sub_fname, new @constructor sub_fsmd
  #   @fsm_names    = freeze fsm_names
  #   @has_subfsms  = fsm_names.length > 0
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_data: ->
  #   @_tmp.known_names.add 'data'
  #   return null unless ( data = @_tmp.fsmd.data )?
  #   @data = {}
  #   for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd.data
  #     Object.defineProperty @data, pname, propd
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _compile_cascades: ->
  #   @_tmp.known_names.add 'cascades'
  #   return null unless ( cascades = @_tmp.fsmd.cascades )?
  #   @cascades = new Set cascades
  #   return null

  # #---------------------------------------------------------------------------------------------------------
  # _copy_other_attributes: ->
  #   for pname, propd of Object.getOwnPropertyDescriptors @_tmp.fsmd
  #     continue if @_tmp.known_names.has pname
  #     Object.defineProperty @, pname, propd
  #   return null


############################################################################################################
module.exports = Intermatic
# if globalThis.require? then module.exports        = { Intermatic, }
# else                        globalThis.Intermatic = Intermatic



