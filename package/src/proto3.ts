import { Result } from "bplus-parser"
import { between, char, exact, many, many1, maybe, Parser, space, any, flatten3, flatten5, attempt, map, anyL, separated1, and, flatten6, labeled, flatten4, StringStream, separated1L } from "bplus-parser"

// SCHEMA

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

type AnyInfo =
    | OneofInfo
    | FieldInfo
    | MapInfo
    | EnumInfo
    | MessageInfo
    | ReservedInfo
    | OptionInfo
    | ValueInfo
    | ImportInfo
    | PackageInfo
    | RangeInfo
    | RpcInfo
    | ServiceInfo
    | undefined // for empty statement?

// DEBUG HELPERS

// function onSuccess<I, O>(value: O, _: Stream<I>) {
//     console.log("SUCCESS", value)
//     //console.log("REMAINING", remaining)
// }

// function onFailure<I>(error: string, _: I) {
//     console.log("FAILURE", error)
//     //console.log("REMAINING", remaining)
// }

// function trace<I, O>(parser: Parser<I, O>) {
//     return debug(parser, onSuccess, onFailure)
// }

// HELPERS

const spaces = many(space)

function hasValue<T>(value: T | undefined | null): boolean {
    return value !== undefined && value !== null
}

function toString(values: (string | undefined | null)[]): string {
    return values.filter(hasValue).join("")
}

function spx<T>(value: Parser<string, T>): Parser<string, T> {
    return Parser.combine(spaces)
        .take(value)
        .build(value.label)
}

function sp(value: string | Parser<string, string>): Parser<string, string> {
    return (typeof value === "string")
        ? Parser.combine(spaces)
            .take(exact(value))
            .build()
        : Parser.combine(spaces)
            .take(value)
            .build(value.label)
}

function info(parser: Parser<string, AnyInfo>): Parser<string, AnyInfo> {
    return parser
}

// LETTERS & DIGITS

const letter = char("LETTER", /[a-zA-Z]/)
const decimalDigit = char("DECIMAL DIGIT", /[0-9]/)
const octalDigit = char("OCTAL DIGIT", /[0-7]/)
const hexDigit = char("HEX DIGIT", /[0-9a-fA-F]/)

// IDENTIFIERS

const ident = Parser.combine(letter)
    .and(many(any(letter, decimalDigit, exact("_"))))
    .map(a => a[0] + a[1].join(""))
    .build("IDENTITY")

const fullIdent = map(separated1L("FULL IDENTITY", exact("."), ident), a => a.join("."))

// const fullIdent = Parser.combine(ident)
//     .and(many(and(exact("."), ident)))
//     .map(a => a[0] + a[1].map(aa => aa[0] + aa[1]).join(""))
//     .build("FULL IDENTITY")

const messageName = labeled("MESSAGE NAME", ident)
const enumName = labeled("ENUM NAME", ident)
const fieldName = labeled("FIELD NAME", ident)
const oneofName = labeled("ONEOF NAME", ident)
const mapName = labeled("MAP NAME", ident)
const serviceName = labeled("SERVICE NAME", ident)
const rpcName = labeled("RPC NAME", ident)

const messageType = Parser.combine(maybe(exact(".")))
    .and(many(and(ident, exact("."))))
    .and(sp(messageName))
    .map(flatten3)
    .map(a => (a[0] || "") + a[1].map(toString).join("") + a[2])
    .build("MESSAGE TYPE")

const enumType = Parser.combine(maybe(exact(".")))
    .and(many(and(ident, exact("."))))
    .and(enumName)
    .map(flatten3)
    .map(a => (a[0] || "") + a[1].map(toString).join("") + a[2])
    .build("ENUM TYPE")

// INTEGER LITERALS

const decimalLit = Parser.combine(many1(decimalDigit))
    .map(a => a.join(""))
    .build("DECIMAL LITERAL")

const octalLit = Parser.combine(exact("0"))
    .and(many(octalDigit))
    .map(a => a[0] + a[1].join(""))
    .build("OCTAL LITERAL")

const hexLit = Parser.combine(exact("0"))
    .and(char("X", /[xX]/))
    .and(hexDigit)
    .and(many(hexDigit))
    .map(flatten4)
    .map(a => a[0] + a[1] + a[2] + toString(a[3]))
    .build("HEX LITERAL")

const intLit = anyL("INTEGER LITERAL", decimalLit, octalLit, hexLit)

// FLOATING POINT LITERALS

const decimals = Parser.combine(decimalDigit)
    .and(many(decimalDigit))
    .map(a => a[0] + a[1].join(""))
    .build("DECIMALS")

const exponent = Parser.combine(char("", /[eE]/))
    .and(maybe(any(exact("+"), exact("-"))))
    .and(decimals)
    .map(flatten3)
    .map(toString)
    .build("EXPONENT")

const floatLit = anyL("FLOAT LITERAL",
    attempt(Parser.combine(decimals)
        .and(exact("."))
        .and(maybe(decimals))
        .and(maybe(exponent))
        .map(flatten4)
        .map(toString)
        .build()),
    Parser.combine(decimals)
        .and(exponent)
        .map(a => a[0] + a[1])
        .build(),
    Parser.combine(exact("."))
        .and(decimals)
        .and(maybe(exponent))
        .map(flatten3)
        .map(toString)
        .build(),
    exact("inf"),
    exact("nan"))

// BOOLEAN

const boolLit = anyL("BOOLEAN LITERAL", exact("true"), exact("false"))

// STRING LITERALS

const quote = anyL("QUOTE", exact("'"), exact("\""))
const charEscape = Parser.combine(exact("\\"))
    .and(any(exact("a"), exact("b"), exact("f"), exact("n"), exact("r"), exact("t"), exact("v"), exact("\\"), exact("'"), exact("\"")))
    .map(toString)
    .build("CHAR ESCAPE")

const octEscape = Parser.combine(exact("\\"))
    .and(octalDigit)
    .and(octalDigit)
    .and(octalDigit)
    .map(flatten4)
    .map(toString)
    .build("OCTAL ESCAPE")

const hexEscape = Parser.combine(exact("\\"))
    .and(char("", /xX/))
    .and(hexDigit)
    .and(hexDigit)
    .map(flatten4)
    .map(toString)
    .build("HEX ESCAPE")

const charValue = anyL("CHAR VALUE", hexEscape, octEscape, charEscape, char("", /[^"'\0\n\\]/))

const strLit = anyL("STRING LITERAL",
    Parser.combine(exact("'"))
        .take(many(charValue))
        .skip(exact("'"))
        .map(toString)
        .build(),
    Parser.combine(exact("\""))
        .take(many(charValue))
        .skip(exact("\""))
        .map(toString)
        .build())

// EMPTY STATEMENT

const emptyStatement = map(sp(exact(";")), _ => undefined)

// CONSTANT

const constant = anyL("CONSTANT",
    fullIdent,
    attempt(Parser.combine(maybe(any(exact("-"), exact("+"))))
        .and(intLit)
        .map(toString)
        .build()),
    Parser.combine(maybe(any(exact("-"), exact("+"))))
        .and(floatLit)
        .map(toString)
        .build(),
    strLit,
    boolLit)

// SYNTAX

const syntax = Parser.combine(sp("syntax"))
    .and(sp("="))
    .and(sp(quote))
    .take(exact("proto3"))
    .skip(quote)
    .skip(sp(";"))
    .map(a => {
        return {
            kind: "syntax",
            value: a
        } as SyntaxInfo
    })
    .build("SYNTAX")

// IMPORT

const import_ = Parser.combine(sp("import"))
    .take(maybe(any(sp("weak"), sp("public"))))
    .and(sp(strLit))
    .skip(sp(";"))
    .map(a => {
        return {
            kind: "import",
            isPublic: a[0] === "public",
            isWeak: a[0] === "weak",
            value: a[1]
        } as ImportInfo
    })
    .build("IMPORT")

// PACKAGE

const package_ = Parser.combine(sp("package"))
    .take(sp(fullIdent))
    .skip(sp(";"))
    .map(a => {
        return {
            kind: "package",
            value: a
        } as PackageInfo
    })
    .build("PACKAGE")

// OPTION

const optionName = Parser.combine(
    anyL("OPTION NAME",
        ident,
        Parser.combine(sp("("))
            .and(sp(fullIdent))
            .and(sp(")"))
            .map(flatten3)
            .map(toString)
            .build()))
    .and(many(
        Parser.combine(exact("."))
            .and(ident)
            .map(toString)
            .build()
    ))
    .map(a => a[0] + toString(a[1]))
    .build("OPTION NAME")

const option = Parser.combine(sp("option"))
    .take(sp(optionName))
    .skip(sp("="))
    .and(sp(constant))
    .skip(sp(";"))
    .map(a => {
        return {
            kind: "option",
            name: a[0],
            value: a[1]
        } as OptionInfo
    })
    .build()

// FIELDS

const fieldNumber = intLit
const type_ = anyL("TYPE", exact("double"), exact("float"), exact("int32"), exact("int64"), exact("uint32"), exact("uint64"),
    exact("sint32"), exact("sint64"), exact("fixed32"), exact("fixed64"), exact("sfixed32"), exact("sfixed64"),
    exact("bool"), exact("string"), exact("bytes"), messageType, enumType)

// NORMAL FIELD

const fieldOption = Parser.combine(sp(optionName))
    .skip(sp("="))
    .and(sp(constant))
    .map(a => {
        return {
            kind: "option",
            name: a[0],
            value: a[1]
        } as OptionInfo
    })
    .build("FIELD OPTION")

const fieldOptions = separated1(sp(","), spx(fieldOption))

const field = Parser.combine(maybe(sp("repeated")))
    .and(sp(type_))
    .and(sp(fieldName))
    .skip(sp("="))
    .and(sp(fieldNumber))
    .and(maybe(between(sp("["), sp("]"), fieldOptions)))
    .skip(sp(";"))
    .map(flatten5)
    .map(a => {
        return {
            kind: "field",
            repeated: a[0] === "repeated",
            type: a[1],
            name: a[2],
            index: Number.parseInt(a[3]),
            options: a[4] || []
        } as FieldInfo
    })
    .build("FIELD")

// ONEOF FIELD

const oneofField = Parser.combine(sp(type_))
    .and(sp(fieldName))
    .skip(sp("="))
    .and(sp(fieldNumber))
    .and(maybe(between(sp("["), sp("]"), fieldOptions)))
    .skip(sp(";"))
    .map(flatten4)
    .map(a => {
        return {
            kind: "field",
            repeated: false,
            type: a[0],
            name: a[1],
            index: Number.parseInt(a[2]),
            options: a[3] || []
        } as FieldInfo
    })
    .build("ONEOF FIELD")

const oneof = Parser.combine(sp("oneof"))
    .take(sp(oneofName))
    .skip(sp("{"))
    .and(many(any(info(option), info(oneofField), info(emptyStatement))))
    .skip(sp("}"))
    .map(a => {
        return {
            kind: "oneof",
            name: a[0],
            fields: a[1].filter(v => v?.kind === "field"),
            options: a[1].filter(v => v?.kind === "option"),
        } as OneofInfo
    })
    .build("ONEOF")

// MAP FIELD

const keyType = anyL("KEY TYPE",
    exact("int32"), exact("int64"), exact("uint32"), exact("uint64"), exact("sint32"), exact("sint64"),
    exact("fixed32"), exact("fixed64"), exact("sfixed32"), exact("sfixed64"), exact("bool"), exact("string"))

const mapField = Parser.combine(sp("map"))
    .skip(sp("<"))
    .take(sp(keyType))
    .skip(sp(","))
    .and(sp(type_))
    .skip(sp(">"))
    .and(sp(mapName))
    .skip(sp("="))
    .and(sp(fieldNumber))
    .and(maybe(between(sp("["), sp("]"), fieldOptions)))
    .skip(sp(";"))
    .map(flatten5)
    .map(a => {
        return {
            kind: "map",
            name: a[2],
            keyType: a[0],
            type: a[1],
            index: Number.parseInt(a[3]),
            options: a[4] || [],
        } as MapInfo
    })
    .build("MAP FIELD")

// RESERVED

const fieldNames = separated1L("RESERVED NAMES", sp(","), sp(between(quote, quote, fieldName)))

const range = Parser.combine(intLit)
    .and(maybe(
        Parser.combine(sp("to"))
            .skip(spaces)
            .take(any(intLit, exact("max")))
            .build()
    ))
    .map(a => {
        return {
            kind: "range",
            from: Number.parseInt(a[0]),
            to: a[1] === "max"
                ? "max"
                : a[1] !== undefined
                    ? Number.parseInt(a[1])
                    : Number.parseInt(a[0])
        } as RangeInfo
    })
    .build("RESERVED RANGE")

const ranges = separated1(sp(","), spx(range))

const reserved = anyL("RESERVED",
    attempt(Parser.combine(sp("reserved"))
        .skip(spaces)
        .take(ranges)
        .map(a => {
            return {
                kind: "reserved",
                names: [],
                ranges: a
            } as ReservedInfo
        })
        .build()),
    Parser.combine(sp("reserved"))
        .skip(spaces)
        .take(fieldNames)
        .map(a => {
            return {
                kind: "reserved",
                names: a,
                ranges: []
            } as ReservedInfo
        })
        .build())

// TOP LEVEL DEFINITIONS

// ENUM DEFINITION

const enumValueOption = Parser.combine(sp(optionName))
    .skip(sp("="))
    .and(sp(constant))
    .map(a => {
        return {
            kind: "option",
            name: a[0],
            value: a[1]
        } as OptionInfo
    })
    .build("ENUM VALUE OPTION")

const enumValueOptions = separated1(sp(","), spx(enumValueOption))

const enumField = Parser.combine(sp(ident))
    .skip(sp("="))
    .and(maybe(sp("-")))
    .and(sp(intLit))
    .and(maybe(between(sp("["), sp("]"), enumValueOptions)))
    .skip(sp(";"))
    .map(flatten4)
    .map(a => {
        return {
            kind: "value",
            name: a[0],
            value: Number.parseInt(toString([a[1], a[2]])),
            options: a[3] || []
        } as ValueInfo
    })
    .build("ENUM FIELD")

const enum_ = Parser.combine(sp("enum"))
    .take(sp(enumName))
    .skip(sp("{"))
    .and(many(any(info(option), info(enumField), info(emptyStatement))))
    .skip(sp("}"))
    .map(a => {
        return {
            kind: "enum",
            name: a[0],
            values: a[1].filter(v => v?.kind === "value"),
            options: a[1].filter(v => v?.kind === "option"),
        } as EnumInfo
    })
    .build("ENUM")

// MESSAGE DEFINITION

const recMessage: Parser<string, AnyInfo> = {
    label: "",
    parse: (_) => { throw "not initialized" }
}

const message = Parser.combine(sp("message"))
    .map(a => {
        // lazy initialize this parser because of it's recursive declaration
        if (!recMessage.label) {
            recMessage.label = "MESSAGE"
            recMessage.parse = message.parse
        }
        return a
    })
    .take(sp(messageName))
    .skip(sp("{"))
    .skip(spaces)
    .and(many(any(info(field), info(enum_), info(recMessage), info(option), info(oneof), info(mapField), info(reserved), info(emptyStatement))))
    .skip(sp("}"))
    .map(a => {
        return {
            kind: "message",
            name: a[0],
            reserved: a[1].filter(v => v?.kind === "reserved"),
            fields: a[1].filter(v => v?.kind === "field"),
            oneofs: a[1].filter(v => v?.kind === "oneof"),
            maps: a[1].filter(v => v?.kind === "map"),
            enums: a[1].filter(v => v?.kind === "enum"),
            messages: a[1].filter(v => v?.kind === "message"),
            options: a[1].filter(v => v?.kind === "option")
        } as MessageInfo
    })
    .build("MESSAGE")

// SERVICE DEFINITION

const rpc = Parser.combine(sp("rpc"))
    .take(sp(rpcName))
    .skip(sp("("))
    .and(maybe(sp("stream")))
    .and(sp(messageType))
    .skip(sp(")"))
    .skip(sp("returns"))
    .skip(sp("("))
    .and(maybe(sp("stream")))
    .and(sp(messageType))
    .skip(sp(")"))
    .and(any(
        Parser.combine(sp("{"))
            .take(many(any(info(option), info(emptyStatement))))
            .skip(sp("}"))
            .build(),
        map(sp(";"), _ => undefined)
    ))
    .map(flatten6)
    .map(a => {
        return {
            kind: "rpc",
            name: a[0],
            request: {
                kind: "request",
                stream: a[1] === "stream",
                type: a[2],
            },
            response: {
                kind: "response",
                stream: a[3] === "stream",
                type: a[4]
            },
            options: a[5] ? a[5].filter(v => v?.kind === "option") : []
        } as RpcInfo
    })
    .build("RPC")

const service = Parser.combine(sp("service"))
    .take(sp(serviceName))
    .skip(sp("{"))
    .and(many(any(info(option), info(rpc), info(emptyStatement))))
    .skip(sp("}"))
    .map(a => {
        return {
            kind: "service",
            name: a[0],
            rpcs: a[1]
        } as ServiceInfo
    })
    .build("SERVICE")

// PROTO FILE

const topLevelDef = any(info(message), info(enum_), info(service))

const proto = Parser.combine(syntax)
    .and(many(any(info(import_), info(package_), info(option), topLevelDef, info(emptyStatement))))
    .map(a => {
        return {
            kind: "proto",
            syntax: a[0].value,
            package: a[1].filter(v => v?.kind === "package").map(v => (<PackageInfo>v).value).pop() || "",
            imports: a[1].filter(v => v?.kind === "import"),
            enums: a[1].filter(v => v?.kind === "enum"),
            messages: a[1].filter(v => v?.kind === "message"),
            options: a[1].filter(v => v?.kind === "option"),
        } as ProtoInfo
    })
    .build("PROTO")

// PUBLIC

export module Syntax {
    export const parser = syntax
}

export module Import {
    export const parser = import_
}

export module Package {
    export const parser = package_
}

export module Option {
    export const parser = option
}

export module Field {
    export const parser = field
}

export module Oneof {
    export const parser = oneof
}

export module Map {
    export const parser = mapField
}

export module Reserved {
    export const parser = reserved
}

export module Enum {
    export const parser = enum_
}

export module Message {
    export const parser = message
}

export module Service {
    export const parser = service
}

export module Proto3 {
    export const parser = proto

    const comment = /\/\/(.*?)[\r\n]/g
    const comments = /\/\*(.|[\r\n])*?\*\//g

    // todo prefer this to be non destructive
    function stripComments(value: string) {
        const pass1 = value.replace(comment, "")
        const pass2 = pass1.replace(comments, "")
        return pass2
    }

    export function read(content: string): ReadResult {
        const stripped = stripComments(content)
        const stream = StringStream.create(stripped)
        const parsed = parser.parse(stream)

        const result: ReadResult = Result.match(parsed,
            success => { return { success: true, message: "", proto: success.value } as ReadResult },
            failure => { return { success: false, message: failure.error, proto: undefined } as ReadResult })

        return result
    }
}
