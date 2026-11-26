---
status: proposed
date: 2026-11-26
decision-makers:
  - maintainers
applies-to:
  - src/utils/FileSetPathUtils.ts
  - src/utils/ConfigTreePath.ts
repos:
  - rockcarver/frodo-cli
  - rockcarver/frodo-lib
issues:
  - rockcarver/frodo-cli#1365
  - rockcarver/frodo-lib#1114
---

# A name that does not fit in a file name is shortened and ends with a checksum

## Context and problem statement

A pull names the file of an object after its id, and a file name holds 255 bytes with its extension. The servers accept ids of thousands of characters, and some ids are not text (a lone surrogate). When this was decided, on 2026-11-26, such an id was cut silently, so two ids that start alike shared one name and the later object was not pulled, or it was refused, or it failed a whole file set at the gate. A name has to be a pure function of the id, so that a pull twice gives the same tree and a diff in version control stays small. [Core 0024](0024-the-library-turns-configuration-into-file-sets-and-back-and-never-touches-the-file-system.md) says the files of a pull do not change, so the rule for a long name is decided once, for good.

## Decision

- **A name that fits is not changed.** An id fits when it is text and its complete encoded name (every character of a path written out as `%XX`, every `*` counted, nothing cut) and the longest suffix that the type puts after the name are at most 255 bytes. The name of an id that fits is the name it has always had, byte for byte.
- **A name that does not fit is a shortened name:** the start of the encoded name, `~`, and a checksum. The start is cut at a whole character to leave room for the suffix, the `~` and the 8 characters of the checksum, and never inside an escape (`%2F`, or the two halves of `%C2%85`). The checksum is the first 8 lowercase hexadecimal characters of the SHA-256 of the complete id, read as UTF-16 code units, so a lone surrogate keeps its own code unit and two ids that differ only there differ. A lone surrogate in the start is written as U+FFFD.
- **One name for one object.** The suffix is the longest one that the type uses with the name (`.json` when it names none). The type makes the name of an object once, with that suffix, and gives it to every file of the object. A name is never made from a name that was shortened already.
- **A push never reads a file name.** The id of an object is the id that its file holds.
- **A clash is reported, never settled by renaming.** Two ids that share a start and a checksum get one name. The consumer keeps the first, reports the later one as a collision and writes nothing over the first, so a name never depends on the other ids.
- **The format is permanent.** The separator, the length and the input of the checksum, the hash and the cut do not change under this record. A change is a new record that supersedes this one, and it moves every shortened name that was written. The library and the CLI each keep a copy of the functions, and a table of names made by an independent implementation (Python, `hashlib`) pins the format in the tests of both.

## Consequences

- No pull loses an object because its name is long, and an id that is not text gets a file like any other.
- An id that was cut or refused before gets its shortened name at the next pull; a file that an older pull wrote under another name is left to the consumer to remove.
- Ids that start alike for 241 characters or more are told apart by the checksum, and a name is no longer the id, so a consumer that wants an id reads it from the file.
- Not covered: the folders of realms, the names that Windows reserves, and the length of a whole path.

## Alternatives considered

- **A longer checksum.** Fewer clashes, longer names; 8 characters is enough because a clash is reported and no file is lost.
- **Renaming on a clash.** Rejected: a name would depend on the other ids, and a pull twice could differ.
- **Refusing a name that is too long.** Rejected: the object is not pulled, and the pull says so only for that object.
