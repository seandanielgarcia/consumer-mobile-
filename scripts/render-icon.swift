import AppKit
// Regenerate the app icon and splash mark: `swift scripts/render-icon.swift assets`
// yardsale app icon + splash mark in the map style: lavender ground, lime pin, navy "y".
func hex(_ h: UInt32) -> NSColor { NSColor(deviceRed: CGFloat((h >> 16) & 0xff)/255, green: CGFloat((h >> 8) & 0xff)/255, blue: CGFloat(h & 0xff)/255, alpha: 1) }
let lavender = hex(0xF3F2FA), navy = hex(0x1B1B3A), lime = hex(0xB6F03A), white = NSColor.white

// Draws straight into a bitmap of exactly `px` pixels. `opaque` = 24-bit RGB (app icons must not carry alpha).
func render(px: Int, opaque: Bool, markScale: CGFloat, to path: String) {
  let size = CGFloat(px)
  // A CoreGraphics context chooses the pixel format: noneSkipLast = 24-bit colour with no alpha (what app icons need).
  let info = opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue
  let cg = CGContext(data: nil, width: px, height: px, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: info)!
  NSGraphicsContext.saveGraphicsState()
  let gc = NSGraphicsContext(cgContext: cg, flipped: false)
  NSGraphicsContext.current = gc
  if opaque { lavender.setFill(); NSRect(x: 0, y: 0, width: size, height: size).fill() }
  else { cg.clear(CGRect(x: 0, y: 0, width: size, height: size)) }
  let d = size * markScale
  let pin = NSRect(x: (size-d)/2, y: (size-d)/2, width: d, height: d)
  cg.saveGState()
  cg.setShadow(offset: CGSize(width: 0, height: -size*0.02), blur: size*0.06, color: navy.withAlphaComponent(0.22).cgColor)
  white.setFill(); NSBezierPath(ovalIn: pin).fill()
  cg.restoreGState()
  let ring = d * 0.055
  lime.setFill(); NSBezierPath(ovalIn: pin.insetBy(dx: ring, dy: ring)).fill()
  let font = NSFont.systemFont(ofSize: d * 0.62, weight: .black)
  let str = NSAttributedString(string: "y", attributes: [.font: font, .foregroundColor: navy])
  let sz = str.size()
  str.draw(at: NSPoint(x: (size - sz.width)/2, y: (size - sz.height)/2 + d*0.06))
  NSGraphicsContext.restoreGraphicsState()
  let image = cg.makeImage()!
  let rep = NSBitmapImageRep(cgImage: image)
  let png = rep.representation(using: .png, properties: [:])!
  try! png.write(to: URL(fileURLWithPath: path))
  print("wrote", path, px, opaque ? "opaque" : "alpha")
}
let out = CommandLine.arguments[1]
render(px: 1024, opaque: true, markScale: 0.66, to: out + "/icon.png")
render(px: 1024, opaque: false, markScale: 0.40, to: out + "/splash-icon.png")
