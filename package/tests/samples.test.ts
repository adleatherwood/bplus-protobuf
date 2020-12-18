import * as fs from 'fs'
import { ContentReader, Extract } from "../src/extractor"
import { MessageInfo, Proto3 } from '../src/proto3'

describe("sample tests", () => {

    function createReader(): ContentReader {
        return {
            exists: (fn) => fs.existsSync(fn),
            read: (fn) => fs.readFileSync(fn, { encoding: "utf8" }),
        }
    }

    test("basic read test", () => {
        const content = fs.readFileSync("./samples/root/Entities.proto", { encoding: "utf8" })
        const actual = Proto3.read(content)

        if (!actual.proto)
            fail("proto not parsed")

        expect(actual.success).toBe(true)
        expect(actual.proto.messages[0].name).toBe("Person")
    })

    test("basic extract test", () => {
        //let result = Extract.protos(reader(), "./samples/realz/", ["divisions/model/entityStates/Contract.proto"])
        const reader = createReader()
        const result = Extract.protos(reader, "./samples/root", ["Entities.proto"])
        const actual = result.protos
            .reduce((r, p) => r.concat(p.messages), [] as MessageInfo[])
            .map(m => m.name)
            .sort()

        expect(actual).toEqual(["Address", "Name", "Person"])
    })

    test("literal include test", () => {
        const reader = createReader()
        const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], ["examples.entities.Person"])
        const actual = result.protos
            .reduce((r, p) => r.concat(p.messages), [] as MessageInfo[])
            .map(m => m.name)
            .sort()

        expect(actual).toEqual(["Address", "Name", "Person"])
    })

    test("expression include test", () => {
        const reader = createReader()
        const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], [/Person/])
        const actual = result.protos
            .reduce((r, p) => r.concat(p.messages), [] as MessageInfo[])
            .map(m => m.name)
            .sort()

        expect(actual).toEqual(["Address", "Name", "Person"])
    })

    test("literal exclude test", () => {
        const reader = createReader()
        const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], "all", ["examples.components.Name"])
        const actual = result.protos
            .reduce((r, p) => r.concat(p.messages), [] as MessageInfo[])
            .map(m => m.name)
            .sort()

        expect(actual).toEqual(["Address", "Person"])
    })

    test("expression exclude test", () => {
        const reader = createReader()
        const result = Extract.protos(reader, "./samples/root", ["Entities.proto"], "all", [/Name/])
        const actual = result.protos
            .reduce((r, p) => r.concat(p.messages), [] as MessageInfo[])
            .map(m => m.name)
            .sort()

        expect(actual).toEqual(["Address", "Person"])
    })
})