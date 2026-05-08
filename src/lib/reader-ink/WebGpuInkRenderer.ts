import { StrokeMesher, VERTEX_BYTES, VERTEX_FLOATS } from "./StrokeMesher";
import type { StrokeBuffer } from "./StrokeBuffer";
import type { ContentMetrics, InkLayerOptions, InkRenderer } from "./types";

const GPU_BUFFER_BYTES = 5 * 1024 * 1024;

const gpuConstants = {
  bufferUsage:
    (globalThis as typeof globalThis & { GPUBufferUsage?: Record<string, number> })
      .GPUBufferUsage ?? { VERTEX: 32, COPY_DST: 8, UNIFORM: 64 },
  shaderStage:
    (globalThis as typeof globalThis & { GPUShaderStage?: Record<string, number> })
      .GPUShaderStage ?? { VERTEX: 1, FRAGMENT: 2 },
  textureUsage:
    (globalThis as typeof globalThis & { GPUTextureUsage?: Record<string, number> })
      .GPUTextureUsage ?? { RENDER_ATTACHMENT: 16 },
};

export class WebGpuInkRenderer implements InkRenderer {
  readonly kind = "webgpu";
  ready = false;

  private device: any = null;
  private context: any = null;
  private pipeline: any = null;
  private bindGroup: any = null;
  private vertexBuffer: any = null;
  private uniformBuffer: any = null;
  private readonly uniformData = new Float32Array(4);
  private metrics: ContentMetrics | null = null;
  private mesher: StrokeMesher;
  private options: InkLayerOptions;
  private activeVertexCount = 0;
  private destroyed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: InkLayerOptions,
  ) {
    this.options = options;
    this.mesher = new StrokeMesher(Math.floor(GPU_BUFFER_BYTES / VERTEX_BYTES));
    void this.init();
  }

  setOptions(options: InkLayerOptions): void {
    this.options = options;
  }

  resize(metrics: ContentMetrics): void {
    this.metrics = metrics;
    if (!this.ready || !this.device || !this.context) return;

    const format = this.getCanvasFormat();
    this.context.configure({
      device: this.device,
      format,
      alphaMode: "premultiplied",
      usage: gpuConstants.textureUsage.RENDER_ATTACHMENT,
    });
    this.writeUniforms();
    this.render();
  }

  beginStroke(color: string): void {
    this.activeVertexCount = 0;
    this.mesher.reset(color, this.options);
    this.render();
  }

  appendStroke(stroke: StrokeBuffer, dirtyPointIndex: number): void {
    if (!this.ready || !this.device || !this.vertexBuffer) return;

    this.mesher.meshTail(stroke, dirtyPointIndex);
    this.activeVertexCount = this.mesher.vertexCount;

    const dirtyVertexStart = this.mesher.dirtyVertexStart;
    const dirtyFloatStart = dirtyVertexStart * VERTEX_FLOATS;
    const dirtyFloatEnd = this.mesher.vertexCount * VERTEX_FLOATS;
    if (dirtyFloatEnd > dirtyFloatStart) {
      this.device.queue.writeBuffer(
        this.vertexBuffer,
        dirtyVertexStart * VERTEX_BYTES,
        this.mesher.vertices,
        dirtyFloatStart,
        dirtyFloatEnd - dirtyFloatStart,
      );
    }

    this.render();
  }

  endStroke(): void {
    this.render();
  }

  clear(): void {
    this.activeVertexCount = 0;
    this.mesher.vertexCount = 0;
    this.mesher.meshedPointCount = 0;
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    this.ready = false;
    this.vertexBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.vertexBuffer = null;
    this.uniformBuffer = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.bindGroup = null;
  }

  private async init(): Promise<void> {
    const gpu = (navigator as Navigator & { gpu?: any }).gpu;
    if (!gpu) return;

    const adapter = await gpu.requestAdapter?.({
      powerPreference: "high-performance",
    });
    if (!adapter || this.destroyed) return;

    const device = await adapter.requestDevice?.();
    if (!device || this.destroyed) return;

    const context = this.canvas.getContext("webgpu") as any;
    if (!context || this.destroyed) return;

    this.device = device;
    this.context = context;

    this.vertexBuffer = device.createBuffer({
      size: GPU_BUFFER_BYTES,
      usage: gpuConstants.bufferUsage.VERTEX | gpuConstants.bufferUsage.COPY_DST,
    });

    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: gpuConstants.bufferUsage.UNIFORM | gpuConstants.bufferUsage.COPY_DST,
    });

    const shader = device.createShaderModule({
      code: `
struct Uniforms {
  viewport: vec2<f32>,
  contentOffset: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexIn {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
  let viewportPosition = input.position + uniforms.contentOffset;
  let clip = vec2<f32>(
    (viewportPosition.x / uniforms.viewport.x) * 2.0 - 1.0,
    1.0 - (viewportPosition.y / uniforms.viewport.y) * 2.0
  );
  var output: VertexOut;
  output.position = vec4<f32>(clip, 0.0, 1.0);
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  return input.color;
}
      `,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: gpuConstants.shaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: shader,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: VERTEX_BYTES,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.getCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    this.ready = true;
    if (this.metrics) this.resize(this.metrics);
  }

  private getCanvasFormat(): string {
    const gpu = (navigator as Navigator & { gpu?: any }).gpu;
    return gpu?.getPreferredCanvasFormat?.() ?? "bgra8unorm";
  }

  private writeUniforms(): void {
    if (!this.device || !this.uniformBuffer || !this.metrics) return;

    this.uniformData[0] = this.metrics.viewportWidth;
    this.uniformData[1] = this.metrics.viewportHeight;
    this.uniformData[2] = this.metrics.contentLeft;
    this.uniformData[3] = this.metrics.contentTop;

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformData,
    );
  }

  private render(): void {
    if (
      !this.ready ||
      !this.device ||
      !this.context ||
      !this.pipeline ||
      !this.bindGroup ||
      !this.vertexBuffer
    ) {
      return;
    }

    this.writeUniforms();

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    if (this.activeVertexCount > 0) {
      pass.draw(this.activeVertexCount, 1, 0, 0);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
