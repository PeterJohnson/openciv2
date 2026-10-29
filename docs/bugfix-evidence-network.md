# First network-input boundary tranche

These checks apply in every mode under [BUGS.md](BUGS.md)'s memory-error policy, including
`CIV2_CLASSIC` and mixed original/OpenCiv2 games. Accepted messages retain their bytes and
normal handling. There is no new packet format or change to valid gameplay. Malformed
messages are dropped; diagnostic message names outside the table are printed numerically.

`BF-*` below are Peter Johnson's independent reconstruction's ledger identifiers. The
corresponding defects remain in base `17842e4497c5a6d3d5be9245cf080ce0dde535fc`.

| Evidence | Original/current boundary | Correction |
| --- | --- | --- |
| BF-179, BF-280 | `0059bc41` secure callback; `0047f13d` within `NetSession::process_messages` | Require all 16 header bytes within the captured transport/queue size before header fields or receive counters. Guard the 169-entry message-counter/name domain too. `NetMsgQueue` already retains the captured allocation length; do not trust the peer's advertised length instead. |
| BF-179, BF-181 | `0059bc41` invalid-message diagnostic scan | Search only candidate offsets with a complete four-DWORD header. Copy unaligned candidates to a local header. Bound the diagnostic name table; unknown values are logged as numbers, never used as pointers. |
| BF-180, BF-223, BF-246 | `0059bb54` broadcast filtering; `recv_hello` / `game_list_add` | Require a complete named discovery record, an in-range inner type and terminated address/filter strings before comparisons. Server announcements require the complete record and a NUL inside each fixed string that later list/UI consumers read. |
| BF-177, BF-183, BF-276 | `00480317`, `NM_CHAT` | Require the seven-argument prefix, 1..257 captured text bytes and a NUL within that payload. The 257-byte limit comes from the actual kind-4 `chat.input_buffer` allocation and sender. Sender/recipient must be civilization slots 0..7 before naming, mute-array or relay use. |

The shared guard runs before queue admission in both callbacks and before counters/dispatch
after dequeue. This also protects queue-full diagnostic names from out-of-table outer types.
Discovery filtering keeps the original semantics: an empty or matching target is accepted,
and a nonempty self-address is ignored. Chat text is rejected rather than truncated or
terminated artificially. Bytes after an existing NUL remain unchanged.

Run the focused executable regression:

```sh
CXX='g++ -m32' python3 tests/source_probe.py tests/network_input_test.cpp
# Or: set CXX=cl, in an x86 Visual Studio developer shell, then the Python command.
```

It compiles the actual guard and both callbacks with production message layouts and small
queue/log providers. Debug and optimized runs check every short header, discovery-prefix
and server-announcement extent; unterminated strings; invalid outer/inner types; retained
target/self filtering; valid, empty, unterminated and maximum/oversized chats; invalid civ
slots; and fitting/nonfitting unaligned diagnostic headers. The copy/search providers check
their reads against the captured extent even when the test allocation has extra backing.
Valid secure packets must enqueue byte-for-byte unchanged. Full poll-loop execution,
physical transport, mixed-peer sessions and replay equivalence are not established here.

This is a first tranche, **not validation of every message body**. State-image/delta decoders,
parley transaction spans, startup/rule imports and other command-specific selector/length
checks still need separate patches and fixtures. The shared guard intentionally admits
other in-range message types after the common envelope check; it is not a security audit
completion claim. Local configuration strings and internally generated queue entries also
remain outside this tranche.
