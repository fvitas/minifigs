// Cuts the subject out of a photo with Vision's foreground instance mask and writes it as a grey
// PNG. Driven by scripts/parts/masks.ts; the build itself only ever reads the PNGs it leaves behind.
import CoreImage
import Foundation
import Vision

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  FileHandle.standardError.write(Data("usage: subject-mask <photo> <mask.png>\n".utf8))
  exit(2)
}

let handler = VNImageRequestHandler(url: URL(fileURLWithPath: arguments[1]), options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let observation = request.results?.first else {
  FileHandle.standardError.write(Data("no subject found\n".utf8))
  exit(1)
}

// Every instance, not just the most prominent one: a front-and-back photo holds two torsos, and the
// crop that keeps the front half still needs the back half cut out to find the gap between them.
let mask = try observation.generateScaledMaskForImage(
  forInstances: observation.allInstances,
  from: handler
)
try CIContext().writePNGRepresentation(
  of: CIImage(cvPixelBuffer: mask),
  to: URL(fileURLWithPath: arguments[2]),
  format: .L8,
  colorSpace: CGColorSpaceCreateDeviceGray()
)
print("\(observation.allInstances.count) instance(s)")
