declare module "gif.js" {
  export interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    background?: string;
    transparent?: string | null;
    repeat?: number;
  }

  export interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
  }

  export default class GIF {
    constructor(options: GIFOptions);
    addFrame(
      image: CanvasRenderingContext2D | HTMLCanvasElement | HTMLImageElement,
      options?: AddFrameOptions,
    ): void;
    on(event: "finished", callback: (blob: Blob) => void): void;
    on(event: "abort", callback: () => void): void;
    on(event: "progress", callback: (progress: number) => void): void;
    render(): void;
  }
}
