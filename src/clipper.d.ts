declare module "clipper-lib" {
  type IntPoint = { X: number; Y: number };
  const lib: {
    Clipper: {
      new (): {
        AddPaths(paths: IntPoint[][], type: number, closed: boolean): boolean;
        Execute(
          type: number,
          solution: IntPoint[][],
          subjectFill: number,
          clipFill: number,
        ): boolean;
      };
      Area(path: IntPoint[]): number;
    };
    PolyType: { ptSubject: number };
    ClipType: { ctUnion: number };
    PolyFillType: { pftNonZero: number };
  };
  export default lib;
}
