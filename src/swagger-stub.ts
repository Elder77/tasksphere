// Minimal stub for @nestjs/swagger decorators so project compiles without the package.
// If you install @nestjs/swagger and swagger-ui-express, replace imports to the real package.
export const ApiTags = (t: string) => (target: any) => {};
export const ApiOperation = (o: any) => (target: any, key?: any, desc?: any) => {};
export const ApiQuery = (o: any) => (target: any, key?: any, desc?: any) => {};
export const ApiConsumes = (o: any) => (target: any, key?: any, desc?: any) => {};
export const ApiBody = (o: any) => (target: any, key?: any, desc?: any) => {};
export const ApiResponse = (o: any) => (target: any, key?: any, desc?: any) => {};
export const ApiProperty = (o?: any) => (target: any, key?: any) => {};
