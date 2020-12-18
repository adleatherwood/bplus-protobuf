import { Result, StringStream } from "bplus-parser"
import { Map, MapInfo, Option, OptionInfo, Import, ImportInfo, Package, PackageInfo, Syntax, SyntaxInfo, Field, FieldInfo, Oneof, OneofInfo, Reserved, ReservedInfo, Enum, MessageInfo, Message, EnumInfo, ServiceInfo, Service, ProtoInfo, Proto3 } from "../src/proto3"

describe("syntax tests", () => {

    test("syntax example test", () => {
        const stream = StringStream.create(`syntax = "proto3";`)
        const result = Syntax.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "syntax",
            value: "proto3"
        } as SyntaxInfo)
    })
})

describe("import tests", () => {

    test("import example test", () => {
        const stream = StringStream.create(`import public "other.proto";`)
        const result = Import.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "import",
            isPublic: true,
            isWeak: false,
            value: "other.proto"
        } as ImportInfo)
    })
})

describe("package tests", () => {

    test("package example test", () => {
        const stream = StringStream.create(`package foo.bar;`)
        const result = Package.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "package",
            value: "foo.bar"
        } as PackageInfo)
    })
})

describe("option tests", () => {

    test("option example test", () => {
        const stream = StringStream.create(`option java_package = "com.example.foo";`)
        const result = Option.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "option",
            name: "java_package",
            value: "com.example.foo"
        } as OptionInfo)
    })
})

describe("normal field tests", () => {

    test("normal field example test #1", () => {
        const stream = StringStream.create(`foo.bar nested_message = 2;`)
        const result = Field.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "field",
            repeated: false,
            type: "foo.bar",
            name: "nested_message",
            index: 2,
            options: []

        } as FieldInfo)
    })

    test("normal field example test #2", () => {
        const stream = StringStream.create(`repeated int32 samples = 4 [packed=true];`)
        const result = Field.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "field",
            repeated: true,
            type: "int32",
            name: "samples",
            index: 4,
            options: [{
                kind: "option",
                name: "packed",
                value: "true"
            }]
        } as FieldInfo)
    })
})

describe("oneof field tests", () => {

    test("oneof field example test", () => {
        const stream = StringStream.create(`
        oneof foo {
            string name = 4;
            SubMessage sub_message = 9;
        }`)

        const result = Oneof.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "oneof",
            name: "foo",
            fields: [{
                kind: "field",
                repeated: false,
                type: "string",
                name: "name",
                index: 4,
                options: []
            }, {
                kind: "field",
                repeated: false,
                type: "SubMessage",
                name: "sub_message",
                index: 9,
                options: []
            }],
            options: []
        } as OneofInfo)
    })
})

describe("map field tests", () => {

    test("map field example test", () => {
        const stream = StringStream.create(`map<string, Project> projects = 3;`)
        const result = Map.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "map",
            keyType: "string",
            type: "Project",
            name: "projects",
            index: 3,
            options: []
        } as MapInfo)
    })
})

describe("reserved tests", () => {

    test("reserved example test #1", () => {
        const stream = StringStream.create(`reserved 2, 15, 9 to 11;`)
        const result = Reserved.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "reserved",
            names: [],
            ranges: [
                { kind: "range", from: 2, to: 2 },
                { kind: "range", from: 15, to: 15 },
                { kind: "range", from: 9, to: 11 },
            ]
        } as ReservedInfo)
    })

    test("reserved example test #2", () => {
        const stream = StringStream.create(`reserved "foo", "bar";`)
        const result = Reserved.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "reserved",
            names: ["foo", "bar"],
            ranges: []
        } as ReservedInfo)
    })
})

describe("enum parser tests", () => {

    test("enum example test", () => {
        const stream = StringStream.create(`
        enum EnumAllowingAlias {
            option allow_alias = true;
            UNKNOWN = 0;
            STARTED = 1;
            RUNNING = 2 [(custom_option) = "hello world"];
        }`)
        const result = Enum.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "enum",
            name: "EnumAllowingAlias",
            values: [{
                kind: "value",
                name: "UNKNOWN",
                value: 0,
                options: []
            },
            {
                kind: "value",
                name: "STARTED",
                value: 1,
                options: []
            },
            {
                kind: "value",
                name: "RUNNING",
                value: 2,
                options: [{
                    kind: "option",
                    name: "(custom_option)",
                    value: "hello world"
                }]
            }],
            options: [{
                kind: "option",
                name: "allow_alias",
                value: "true"
            }]
        } as EnumInfo)
    })
})

describe("message parser tests", () => {

    test("message example test", () => {
        const stream = StringStream.create(`
        message Outer {
            option (my_option).a = true;
            message Inner {
                int64 ival = 1;
            }
            map<int32, string> my_map = 2;
        }`)
        const result = Message.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "message",
            enums: [],
            fields: [],
            maps: [{
                kind: "map",
                index: 2,
                keyType: "int32",
                type: "string",
                name: "my_map",
                options: []
            }],
            messages: [{
                kind: "message",
                enums: [],
                fields: [{
                    kind: "field",
                    index: 1,
                    name: "ival",
                    options: [],
                    repeated: false,
                    type: "int64"
                }],
                maps: [],
                messages: [],
                name: "Inner",
                oneofs: [],
                options: [],
                reserved: [],
            }],
            name: "Outer",
            oneofs: [],
            options: [{
                kind: "option",
                name: "(my_option).a",
                value: "true"
            }],
            reserved: [],
        } as MessageInfo)
    })
})

describe("service tests", () => {

    test("service example test", () => {
        const stream = StringStream.create(`
        service SearchService {
            rpc Search (SearchRequest) returns (SearchResponse);
        }`)
        const result = Service.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "service",
            name: "SearchService",
            rpcs: [{
                kind: "rpc",
                name: "Search",
                request: {
                    kind: "request",
                    stream: false,
                    type: "SearchRequest",
                },
                response: {
                    kind: "response",
                    stream: false,
                    type: "SearchResponse"
                },
                options: []
            }]
        } as ServiceInfo)
    })
})

describe("proto tests", () => {

    test("proto example test", () => {
        const stream = StringStream.create(`
        syntax = "proto3";
        import public "other.proto";
        option java_package = "com.example.foo";
        enum EnumAllowingAlias {
            option allow_alias = true;
            UNKNOWN = 0;
            STARTED = 1;
            RUNNING = 2 [(custom_option) = "hello world"];
        }
        message outer {
            option (my_option).a = true;
            message inner {
                int64 ival = 1;
            }
            repeated inner inner_message = 2;
            EnumAllowingAlias enum_field =3;
            map<int32, string> my_map = 4;
        }`)
        const result = Proto3.parser.parse(stream)
        const actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))

        expect(actual).toEqual({
            kind: "proto",
            syntax: "proto3",
            package: "",
            imports: [{
                kind: "import",
                value: "other.proto",
                isPublic: true,
                isWeak: false
            }],
            options: [{
                kind: "option",
                name: "java_package",
                value: "com.example.foo"
            }],
            enums: [{
                kind: "enum",
                name: "EnumAllowingAlias",
                values: [{
                    kind: "value",
                    name: "UNKNOWN",
                    value: 0,
                    options: []
                },
                {
                    kind: "value",
                    name: "STARTED",
                    value: 1,
                    options: []
                },
                {
                    kind: "value",
                    name: "RUNNING",
                    value: 2,
                    options: [
                        {
                            kind: "option",
                            name: "(custom_option)",
                            value: "hello world"
                        }
                    ]
                }],
                options: [{
                    kind: "option",
                    name: "allow_alias",
                    value: "true"
                }]
            }],
            messages: [{
                kind: "message",
                enums: [],
                fields: [{
                    kind: "field",
                    repeated: true,
                    type: "inner",
                    name: "inner_message",
                    index: 2,
                    options: []
                }, {
                    kind: "field",
                    repeated: false,
                    type: "EnumAllowingAlias",
                    name: "enum_field",
                    index: 3,
                    options: []
                }],
                maps: [{
                    kind: "map",
                    index: 4,
                    keyType: "int32",
                    type: "string",
                    name: "my_map",
                    options: []
                }],
                messages: [{
                    kind: "message",
                    enums: [],
                    fields: [{
                        kind: "field",
                        index: 1,
                        name: "ival",
                        options: [],
                        repeated: false,
                        type: "int64"
                    }],
                    maps: [],
                    messages: [],
                    name: "inner",
                    oneofs: [],
                    options: [],
                    reserved: [],
                }],
                name: "outer",
                oneofs: [],
                options: [{
                    kind: "option",
                    name: "(my_option).a",
                    value: "true"
                }],
                reserved: [],
            }],
        } as ProtoInfo)
    })
})
