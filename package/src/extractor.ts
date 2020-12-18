import { Linq, Option, self } from "bplus-composer"
import { EnumInfo, MessageInfo, Proto3, ProtoInfo } from "./proto3"

export interface ContentReader {
    exists(filename: string): boolean
    read(filename: string): string
}

export type IncludeExp =
    | RegExp[]
    | string[]
    | "all"

export type ExcludeExp =
    | RegExp[]
    | string[]
    | "none"

type PackageType = string

export type ProgressResult = {
    protos: ProtoInfo[]
    found: PackageType[]
    missing: PackageType[]
}

export type ReadResult = {
    proto: ProtoInfo
    found: PackageType[]
    missing: PackageType[]
}

export type ExtractResult = {
    protos: ProtoInfo[]
    found: PackageType[]
}

module Path {
    export function combine(path: string, file: string): string {
        const delimiter = (path && path.includes("\\")) || (file.includes("\\"))
            ? "\\"
            : "/"

        return path && path[path.length - 1] != delimiter
            ? `${path}${delimiter}${file}`
            : `${path}${file}`
    }
}

module MatchExp {
    export function isRegExp(e: IncludeExp | ExcludeExp): e is RegExp[] {
        return Array.isArray(e) && e.length > 0 && (<RegExp>e[0]).test !== undefined
    }

    export function isLiterals(e: IncludeExp | ExcludeExp): e is string[] {
        return Array.isArray(e) && e.length > 0 && typeof e[0] === "string"
    }

    export function isIncluded(e: IncludeExp, value: string) {
        return isRegExp(e)
            ? e.find(r => r.test(value))
            : isLiterals(e)
                ? e.find(l => l === value)
                : true
    }

    export function isExcluded(e: ExcludeExp, value: string) {
        return isRegExp(e)
            ? e.find(r => r.test(value))
            : isLiterals(e)
                ? e.find(l => l === value)
                : false
    }
}

module PackageType {
    export function ofEnum(packag: string, e: EnumInfo) {
        return ofType(packag, e.name)
    }

    export function ofMessage(packag: string, m: MessageInfo) {
        return ofType(packag, m.name)
    }

    export function ofType(packag: string, type: string) {
        return `${packag}.${type}`
    }
}

module PackageTypes {

    export function ofEnums(packag: string, e: EnumInfo[]) {
        return e.map(ii => PackageType.ofEnum(packag, ii))
    }

    export function* ofMessage(packag: string, message: MessageInfo) {
        const nestedPackage = `${packag}.${message.name}`
        for (const t of ofEnums(nestedPackage, message.enums)) {
            yield t
        }

        for (const m of ofMessages(nestedPackage, message.messages)) {
            yield m
        }

        yield `${packag}.${message.name}`
    }

    export function ofMessages(packag: string, messages: MessageInfo[]): PackageType[] {
        return Linq.query(messages)
            .selectMany(m => ofMessage(packag, m))
            .toArray()
    }

    export function* ofField(packag: string, message: MessageInfo) {
        for (const t of message.fields.map(f => f.type)) {
            if (t.indexOf(".") < 0) {
                for (const implied of ofImplicit(packag, t))
                    yield implied
            }
            else {
                yield t
            }
        }

        for (const t of ofFields(packag, message.messages)) {
            yield t
        }
    }

    export function ofFields(packag: string, messages: MessageInfo[]): PackageType[] {
        return Linq.query(messages)
            .selectMany(m => ofField(packag, m))
            .toArray()
    }

    function* ofImplicit(packag: string, type: string): Iterable<PackageType> {
        let current = packag

        while (current.indexOf(".") >= 0) {
            yield PackageType.ofType(current, type)

            current = current.substr(0, current.lastIndexOf("."))
        }

        yield PackageType.ofType(current, type)
    }
}

export module Merge {
    export function proto(a: ProtoInfo, b: ProtoInfo): ProtoInfo {
        const enums = Linq.query(a.enums)
            .concat(b.enums)
            .distinctBy(e => e.name)
            .toArray()

        const imports = Linq.query(a.imports)
            .concat(b.imports)
            .distinctBy(i => i.value)
            .toArray()

        const messages = Linq.query(a.messages)
            .concat(b.messages)
            .distinctBy(m => m.name)
            .toArray()

        const options = Linq.query(a.options)
            .concat(b.options)
            .distinctBy(o => o.name)
            .toArray()

        return {
            enums: enums,
            imports: imports,
            kind: a.kind,
            messages: messages,
            options: options,
            package: a.package,
            syntax: a.syntax
        }
    }

    export function read(a: ReadResult, b: ProgressResult): ProgressResult {
        if (a.proto.enums.length === 0 && a.proto.messages.length === 0)
            return b

        let extract: ProgressResult = {
            protos: [a.proto],
            found: a.found,
            missing: a.missing
        }

        return Merge.progress(extract, b)
    }

    export function progress(a: ProgressResult, b: ProgressResult): ProgressResult {
        let merged = Linq.query(a.protos)
            .join(b.protos, af => af.package, bf => bf.package, (a, b) => [a, b])
            .select(t => Merge.proto(t[0], t[1]))
            .toArray()

        let protos = Linq.query(a.protos)
            .except(merged, p => p.package)
            .concat(
                Linq.query(b.protos)
                    .except(merged, p => p.package)
                    .toIterable())
            .concat(merged)
            .toArray()

        let found = Linq.query(b.found)
            .concat(a.found)
            .distinctBy(self)
            .toArray()

        let missing = Linq.query(b.missing)
            .concat(a.missing)
            .distinctBy(self)
            .except(found, self)
            .toArray()

        var result: ProgressResult = {
            protos: protos,
            found: found,
            missing: missing,
        }

        return result
    }
}

module ExtractResult {
    export function empty(): ProgressResult {
        return { protos: [], found: [], missing: [] }
    }
}

export module Extract {

    function filterEnums(packag: string, enums: EnumInfo[], include: IncludeExp, exclude: ExcludeExp) {
        return enums
            .filter(e => MatchExp.isIncluded(include, PackageType.ofEnum(packag, e)))
            .filter(e => !MatchExp.isExcluded(exclude, PackageType.ofEnum(packag, e)))
    }

    function filterMessages(packag: string, messages: MessageInfo[], include: IncludeExp, exclude: ExcludeExp) {
        return messages
            .filter(m => MatchExp.isIncluded(include, PackageType.ofMessage(packag, m)))
            .filter(m => !MatchExp.isExcluded(exclude, PackageType.ofMessage(packag, m)))
    }

    function read(file: string, include: IncludeExp, exclude: ExcludeExp, reader: ContentReader): Option<ReadResult> {
        let content = reader.read(file)
        let result = Proto3.read(content)

        if (result.success && result.proto) {
            let proto = result.proto
            let enums = filterEnums(proto.package, proto.enums, include, exclude)
            let messages = filterMessages(proto.package, proto.messages, include, exclude)

            let enumTypes = PackageTypes.ofEnums(proto.package, enums)
            let messageTypes = PackageTypes.ofMessages(proto.package, messages)
            let fieldTypes = PackageTypes.ofFields(proto.package, proto.messages)

            let found = enumTypes.concat(messageTypes)
            let missing = Linq.query(fieldTypes)
                .except(found, self)
                .distinctBy(self)
                .toArray()

            proto.enums = enums
            proto.messages = messages

            return {
                proto: proto,
                found: found,
                missing: missing
            }
        }
        else {
            throw result.message
        }
    }

    function protosRec(root: string, files: string[], include: IncludeExp, exclude: ExcludeExp, reader: ContentReader): ProgressResult {
        let result = ExtractResult.empty()

        for (const file of files) {
            let filepath = Path.combine(root, file)

            if (!reader.exists(filepath))
                continue

            let red = read(filepath, include, exclude, reader)

            if (!red) {
                throw `Unable to read file: ${file} `
            }

            result = Merge.read(red, result)

            if (result.missing.length > 0) {
                let imports = red.proto.imports.map(i => i.value)
                let result2 = protosRec(root, imports, result.missing, exclude, reader)
                result = Merge.progress(result, result2)
            }
        }

        return result
    }

    export function protos(reader: ContentReader, root: string, files: string[], include: IncludeExp = "all", exclude: ExcludeExp = "none"): ExtractResult {
        var result = protosRec(root, files, include, exclude, reader)

        return {
            found: result.found.sort(),
            protos: result.protos
        }
    }
}