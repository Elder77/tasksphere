// Minimal stub for @nestjs/swagger decorators so project compiles without the package.
// If you install @nestjs/swagger and swagger-ui-express, replace imports to the real package.
export const ApiTags = (_t: string) => (_target: any) => {};
export const ApiOperation =
  (_o: any) => (_target: any, _key?: any, _desc?: any) => {};
export const ApiQuery =
  (_o: any) => (_target: any, _key?: any, _desc?: any) => {};
export const ApiConsumes =
  (_o: any) => (_target: any, _key?: any, _desc?: any) => {};
export const ApiBody =
  (_o: any) => (_target: any, _key?: any, _desc?: any) => {};
export const ApiResponse =
  (_o: any) => (_target: any, _key?: any, _desc?: any) => {};
export const ApiProperty = (_o?: any) => (_target: any, _key?: any) => {};
