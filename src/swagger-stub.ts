// Minimal stub for @nestjs/swagger decorators so project compiles without the package.
// If you install @nestjs/swagger and swagger-ui-express, replace imports to the real package.
export const ApiTags = (t: string) => (_target: any) => {
  void t;
  void _target;
};
export const ApiOperation =
  (o: any) => (_target: any, _key?: any, _desc?: any) => {
    void o;
    void _target;
    void _key;
    void _desc;
  };
export const ApiQuery = (o: any) => (_target: any, _key?: any, _desc?: any) => {
  void o;
  void _target;
  void _key;
  void _desc;
};
export const ApiConsumes =
  (o: any) => (_target: any, _key?: any, _desc?: any) => {
    void o;
    void _target;
    void _key;
    void _desc;
  };
export const ApiBody = (o: any) => (_target: any, _key?: any, _desc?: any) => {
  void o;
  void _target;
  void _key;
  void _desc;
};
export const ApiResponse =
  (o: any) => (_target: any, _key?: any, _desc?: any) => {
    void o;
    void _target;
    void _key;
    void _desc;
  };
export const ApiProperty = (o?: any) => (_target: any, _key?: any) => {
  void o;
  void _target;
  void _key;
};
