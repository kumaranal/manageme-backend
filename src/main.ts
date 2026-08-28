import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody is needed to verify Razorpay/Stripe webhook signatures, which are
  // computed over the exact raw request bytes rather than the parsed JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // TEMP debug logging for the GitHub connect flow — remove once it's working.
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('manage-me API')
    .setDescription('API for the manage-me project and issue tracker')
    .setVersion('0.0.1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
