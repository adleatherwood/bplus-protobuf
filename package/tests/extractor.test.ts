import { Linq } from "bplus-composer"
import { Merge, ProgressResult } from "../src/extractor"
import { ProtoInfo } from "../src/proto3"

describe("extractor tests", () => {

    test("merge test", () => {
        const a: ProtoInfo = {
            kind: "proto",
            enums: [{ kind: "enum", options: [], name: "Enum1", values: [] }],
            imports: [{ kind: "import", isPublic: false, isWeak: false, value: "Import1" }],
            messages: [{ kind: "message", name: "Message1", options: [], messages: [], enums: [], fields: [], maps: [], oneofs: [], reserved: [] }],
            options: [{ kind: "option", name: "Option1", value: "" }],
            package: "test",
            syntax: "proto3"
        }

        const b: ProtoInfo = {
            kind: "proto",
            enums: [{ kind: "enum", options: [], name: "Enum2", values: [] }],
            imports: [{ kind: "import", isPublic: false, isWeak: false, value: "Import2" }],
            messages: [{ kind: "message", name: "Message2", options: [], messages: [], enums: [], fields: [], maps: [], oneofs: [], reserved: [] }],
            options: [{ kind: "option", name: "Option2", value: "" }],
            package: "test",
            syntax: "proto3"
        }

        const actual = Merge.proto(a, b)
        const actualEnums = Linq.query(actual.enums).select(i => i.name).toArray().join()
        const actualImports = Linq.query(actual.imports).select(i => i.value).toArray().join()
        const actualMessages = Linq.query(actual.messages).select(i => i.name).toArray().join()
        const actualOptions = Linq.query(actual.options).select(i => i.name).toArray().join()

        expect(actualEnums).toBe("Enum1,Enum2")
        expect(actualImports).toBe("Import1,Import2")
        expect(actualMessages).toBe("Message1,Message2")
        expect(actualOptions).toBe("Option1,Option2")
    })

    test("merge test", () => {
        const a: ProgressResult = {
            found: ["Found1"],
            missing: ["Missing1"],
            protos: [{
                kind: "proto",
                enums: [{ kind: "enum", options: [], values: [], name: "" }],
                imports: [],
                messages: [],
                options: [],
                package: "PackageA",
                syntax: "proto3"
            }]
        }

        const b: ProgressResult = {
            found: ["Found2"],
            missing: ["Missing2"],
            protos: [{
                kind: "proto",
                enums: [],
                imports: [],
                messages: [],
                options: [],
                package: "PackageB",
                syntax: "proto3"
            }]
        }

        const actual = Merge.progress(a, b)

        expect(actual.protos.length).toBe(2)
        expect(actual.found).toEqual(["Found2", "Found1"])
        expect(actual.missing).toEqual(["Missing2", "Missing1"])
    })
})