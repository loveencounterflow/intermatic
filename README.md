


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



