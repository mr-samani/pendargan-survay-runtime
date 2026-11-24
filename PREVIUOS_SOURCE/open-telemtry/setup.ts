import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { AppConsts } from '@core/app-consts';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
export function initOpenTelemtry() {
  if (AppConsts.otl.active == false) {
    return;
  }
  const exporter = new OTLPTraceExporter({
    url: AppConsts.otl.url,
    headers: {
      'X-Seq-ApiKey': AppConsts.otl.key,
    },
  });
  const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'ANGULAR_VOTE' });
  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(exporter),
      // For demo purposes only, immediately log traces to the console
      // new SimpleSpanProcessor(new ConsoleSpanExporter()),
    ],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-document-load': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-user-interaction': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-fetch': {
          enabled: false,
          propagateTraceHeaderCorsUrls: [AppConsts.remoteBaseUrl],
        },
        '@opentelemetry/instrumentation-xml-http-request': {
          enabled: false,
          // applyCustomAttributesOnSpan: (span: Span, xhr: XMLHttpRequest) => {
          //   xhr.addEventListener('loadend', (ev) => {
          //     span.setAttribute('http.request.body', xhr.responseText);
          //     span.setAttribute('http.method', xhr.responseType);
          //   });
          //   span.setAttribute('http.url', xhr.responseURL);
          // },
        },
      }),
    ],
  });
}
