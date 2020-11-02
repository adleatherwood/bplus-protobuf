# bplus-protobuf

A Protocol Buffer 3 compliant parser written in TypeScript.

![pipeline](https://gitlab.com/adleatherwood/bplus-protobuf/badges/master/pipeline.svg)
![coverage](https://gitlab.com/adleatherwood/bplus-protobuf/badges/master/coverage.svg)

#### Note

This project is maintained over at GitLab: https://gitlab.com/adleatherwood/bplus-protobuf

## Read a single proto file

```typescript
const content = fs.readFileSync("./samples/root/Entities.proto", { encoding: "utf8" })
const actual = Proto3.read(content)

if (!actual.proto)
    fail("proto not parsed")

expect(actual.success).toBe(true)
expect(actual.proto.messages[0].name).toBe("Person")
```

## Read multiple proto and recursively resolve dependent types

The I/O is abstracted from the logic so that it can be run from any runtime.  The `ContentReader` abstraction
is what is needed by the extractor to read files.

```typescript
export interface ContentReader {
    exists(filename: string): boolean
    read(filename: string): string
}

function createReader(): ContentReader {
    return {
        exists: (fn) => fs.existsSync(fn),
        read: (fn) => fs.readFileSync(fn, { encoding: "utf8" }),
    }
}
```

Now that we have a "reader" established, We can set up two protos to work with.

**Entities.proto**

```protobuf
syntax = "proto3";

package examples.entities;

import "Components.proto";

message Person {
    string id = 1;
    int Age = 2;
    examples.components.Name Name = 3;
    examples.components.Address Address = 4;
}
```
**Components.proto**
```protobuf
syntax = "proto3";

package examples.components;

message Name {
    string first = 1;
    string last = 2;
}

message Address {
    string line1 = 1;
    string line2 = 2;
    string street = 3;
    string city = 4;
    string zip = 5;
}

message Unrelated {
    string value1 = 1;
}
```

This will parse all types from `Entities.proto` and the walk through the imports list to resolve the
field types from other proto files.

```typescript
const reader = createReader()
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"])
const actual = result.protos
    .reduce((r, p) => r.concat(p.messages), [] as MessageInfo[])
    .map(m => m.name)
    .sort()

// the "Unrelated" type is excluded because it isn't referenced by anything from "Entities.proto"
expect(actual).toEqual(["Address", "Name", "Person"])
```

You can also pass a list of things to include or exclude.  These can be expressed as a `string[] | RegExp[] | "all" | "none"`.  Includes
only work on the top-level protos passed into the second parameter.  They are not applied recursively.  Excludes work on
all levels.  This may seem a little inconsistent, but the premise is this:

* Includes: "Only pull these things from these files & pull anything else they depend on"
* Excludes: "Filter out these things from my end result"

```typescript
// include "all", exclude "none"
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], "all", "none")
// implied include "all", exclude "none"
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"])
// include only the "Person" type from the "Entities.proto"
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], ["examples.entities.Person"])
// include things like /Person/ from the "Entities.proto"
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], [/Person/])
// include "all" from "Entities.proto" and filter out the "Name" type
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], "all", ["examples.components.Name"])
// include "all" from "Entities.proto" and filter out types like /Name/
const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], "all", [/Name/])
```

## The output schema

The full schema of what is return from either a single proto read or an extraction.

```typescript
export type ProtoInfo = {
    kind: "proto"
    syntax: string
    package: string
    imports: ImportInfo[]
    enums: EnumInfo[]
    messages: MessageInfo[]
    options: OptionInfo[]
}

export type SyntaxInfo = {
    kind: "syntax"
    value: string
}

export type PackageInfo = {
    kind: "package"
    value: string
}

export type ImportInfo = {
    kind: "import"
    isPublic: boolean
    isWeak: boolean
    value: string
}

export type OptionInfo = {
    kind: "option"
    name: string
    value: string
}

export type ValueInfo = {
    kind: "value"
    name: string
    value: number
    options: OptionInfo[]
}

export type EnumInfo = {
    kind: "enum"
    name: string
    values: ValueInfo[]
    options: OptionInfo[]
}

export type FieldInfo = {
    kind: "field"
    repeated: boolean
    type: string
    name: string
    index: number
    options: OptionInfo[]
}

export type RangeInfo = {
    kind: "range"
    from: number
    to: number | "max"
}

export type ReservedInfo = {
    kind: "reserved"
    ranges: RangeInfo[]
    names: string[]
}

export type OneofInfo = {
    kind: "oneof"
    name: string
    fields: FieldInfo[]
    options: OptionInfo[]
}

export type MapInfo = {
    kind: "map"
    name: string
    keyType: string
    type: string
    index: number
    options: OptionInfo[]
}

export type MessageInfo = {
    kind: "message"
    name: string
    reserved: ReservedInfo[]
    fields: FieldInfo[]
    oneofs: OneofInfo[]
    maps: MapInfo[]
    enums: EnumInfo[]
    messages: MessageInfo[]
    options: OptionInfo[]
}

export type RequestInfo = {
    kind: "request"
    stream: boolean
    type: string
}

export type ResponseInfo = {
    kind: "response"
    stream: boolean
    type: string
}

export type RpcInfo = {
    kind: "rpc"
    name: string
    request: RequestInfo,
    response: ResponseInfo,
    options: OptionInfo[]
}

export type ServiceInfo = {
    kind: "service"
    name: string
    rpcs: RpcInfo[]
}

export type ReadResult = {
    success: boolean
    message: string
    proto: ProtoInfo | undefined
}

export type ExtractResult = {
    protos: ProtoInfo[]
    found: string[] // this a sorted list of types that were found
}
```

Icons made by [Freepik](https://www.flaticon.com/authors/freepik) from [www.flaticon.com](https://www.flaticon.com/)