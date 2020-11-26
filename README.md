


# InterMatic

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [To Do](#to-do)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

**work in progress**

state machine for NodeJS and the browser

* `fsm.goto = ( to_sname ) -> ...` will be present when an entry `goto: '*'` is present in the top level
  of the FSMD.

* FSMs can be nested, with a sub-FSMs `lamp` referred to by `fsm.my.lamp`, and the super-FSM (i.e. parent in
  the tree) referred to from a sub-FSM as `lamp.we` (i.e. `fsm.my.lamp.we === fsm` holds).

* Nested FSMs thus provide limited namespace such that when a more complex FSM for, say, represent the
  statuses of three backlit buttons `alpha_btn`, `beta_btn`, `gamma_btn` is defined, each button can get its
  very own `lamp` as `alpha_btn.my.lamp`, `beta_btn.my.lamp`, `gamma_btn.my.lamp`, where the definition of
  each `lamp` can be identical (or variants along the same pattern), yet act independently of the other
  `lamp`s.

* Nested FSMs are also a measure to deal with the [combinatorial state
  explosion](https://en.wikipedia.org/wiki/Combinatorial_explosion).

* The state of an FSM is
  * represented *locally* as a JS value / string ??? from 'inside';
  * for the outside, it is a key/value pair, implemented as an object with the FSM's name as sole attribute,
    so if a `lamp` is `lit`, that gives `{ lamp: 'lit', }`

```
alpha_btn:
  ...
  my:
    lamp:
      cyclers:
        toggle: [ 'lit', 'dark', ]
    label:
      values:
        id:     {
          G: { text: 'go',    color: 'green', },
          W: { text: 'wait',  color: 'amber', },
          S: { text: 'stop',  color: 'red',   }, }
      enter:
        id:
          G: { }

```



 * `{ alpha_btn: { lamp: 'lit', color: 'green', label: 'go', } }`

```coffee
fsmd =
  name: 'meta_lamp'
  triggers: [
    [ 'void',   'start',  'lit',  ] # trigger № 1
    [ '*',      'reset',  'void', ] # trigger № 2
    [ 'lit',    'toggle', 'dark', ] # trigger № 3
    [ 'dark',   'toggle', 'lit',  ] # trigger № 4
  cyclers:
    toggle: [ 'lit', 'dark', ] # not yet implemented, alternative to triggers №s 3, 4
  after:
    change:     ( s ) -> register "after change:  #{rpr s}"
  enter:
    dark:       ( s ) -> register "enter dark:    #{rpr s}"
  leave:
    lit:        ( s ) -> register "leave lit      #{rpr s}"
  goto:         '*'
  fail:         ( s ) -> register "failed: #{rpr s}"
#---------------------------------------------------------------------------------------------------------
{ Intermatic, } = require '../../../apps/intermatic'
fsmd            = fsmd
fsm             = new Intermatic fsmd
fsm.start()
fsm.toggle()
fsm.reset()
fsm.toggle()
fsm.goto 'lit'
```

# To Do

* [ ] implement `goto` with list of target (or source and target?) states
* [ ] implement `toggle`



