export {};
declare global {
  interface Window {
    wildformDesktop?: {
      openFiles(options: any): Promise<Array<{path:string;name:string;ext:string;dataUrl:string}>>;
      saveText(options: any): Promise<string|null>;
      loadText(options: any): Promise<{path:string;name:string;text:string}|null>;
    };
  }
}
