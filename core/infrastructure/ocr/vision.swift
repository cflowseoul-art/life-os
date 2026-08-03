// macOS Vision text recognition. Reads an image path, prints recognised lines.
// Offline, no network, no API key. Invoked by the Node OCR adapter.
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1, let image = NSImage(contentsOfFile: args[1]),
      let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("cannot read image\n".data(using: .utf8)!)
    exit(2)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["ko-KR", "en-US"]

do {
    try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
} catch {
    FileHandle.standardError.write("ocr failed\n".data(using: .utf8)!)
    exit(3)
}

let observations = request.results ?? []
// Top-to-bottom, then left-to-right: receipts are read as lines.
let lines = observations
    .sorted { a, b in
        abs(a.boundingBox.midY - b.boundingBox.midY) > 0.01
            ? a.boundingBox.midY > b.boundingBox.midY
            : a.boundingBox.minX < b.boundingBox.minX
    }
    .compactMap { $0.topCandidates(1).first?.string }

print(lines.joined(separator: "\n"))
