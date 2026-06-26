<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Throwable;

class FrontendApiProxyController extends Controller
{
    public function __invoke(Request $request, string $path = ''): Response
    {
        $urls = config('services.pos_backend.urls') ?: [config('services.pos_backend.url')];

        $headers = [
            'X-Frontend-Proxy-Secret' => (string) config('services.pos_backend.proxy_secret'),
            'X-Requested-With' => 'XMLHttpRequest',
        ];

        if ($request->user() !== null) {
            $headers['X-Frontend-User-Id'] = (string) $request->user()->id;
        }

        $connectTimeout = (int) config('services.pos_backend.connect_timeout', 5);
        $timeout = (int) config('services.pos_backend.timeout', 30);

        $lastError = null;
        $timedOut = false;

        foreach ($urls as $backendUrl) {
            $url = rtrim((string) $backendUrl, '/').'/api/v1/'.ltrim($path, '/');

            if ($queryString = $request->getQueryString()) {
                $url .= '?'.$queryString;
            }

            $http = Http::connectTimeout($connectTimeout)
                ->timeout($timeout)
                ->acceptJson()
                ->withHeaders($headers);

            try {
                $response = $this->sendRequest($request, $http, $url);

                return response($response->body(), $response->status())
                    ->withHeaders($this->responseHeaders($response));
            } catch (ConnectionException $exception) {
                $lastError = $exception->getMessage();
                // A cURL timeout (operation/connect) surfaces as ConnectionException.
                $timedOut = $timedOut || $this->looksLikeTimeout($exception->getMessage());
            } catch (Throwable $exception) {
                $lastError = $exception->getMessage();
            }
        }

        if ($timedOut) {
            return response([
                'message' => 'El backend tardó demasiado en responder. Intenta un rango de fechas más corto.',
                'detail' => config('app.debug') ? $lastError : null,
            ], 504);
        }

        return response([
            'message' => 'No se pudo conectar con el backend local.',
            'detail' => config('app.debug') ? $lastError : null,
        ], 502);
    }

    private function looksLikeTimeout(?string $message): bool
    {
        if (! is_string($message) || $message === '') {
            return false;
        }

        $needles = ['timed out', 'timeout', 'Operation timed out', 'cURL error 28'];

        foreach ($needles as $needle) {
            if (stripos($message, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    private function sendRequest(Request $request, PendingRequest $http, string $url): ClientResponse
    {
        $method = strtolower($request->method());

        if (in_array($method, ['get', 'head'], true)) {
            return $http->{$method}($url);
        }

        if ($request->allFiles() !== []) {
            foreach ($this->flattenFiles($request->allFiles()) as $name => $file) {
                $http = $http->attach(
                    $name,
                    fopen($file->getRealPath(), 'r'),
                    $file->getClientOriginalName()
                );
            }

            return $http->{$method}($url, $request->except(array_keys($request->allFiles())));
        }

        if ($request->isJson()) {
            return $http->send($request->method(), $url, [
                'json' => $request->json()->all(),
            ]);
        }

        return $http->send($request->method(), $url, [
            'form_params' => $request->request->all(),
        ]);
    }

    /**
     * @param  array<string, UploadedFile|array<mixed>>  $files
     * @return array<string, UploadedFile>
     */
    private function flattenFiles(array $files, string $prefix = ''): array
    {
        $flattened = [];

        foreach ($files as $key => $file) {
            $name = $prefix === '' ? (string) $key : "{$prefix}[{$key}]";

            if ($file instanceof UploadedFile) {
                $flattened[$name] = $file;

                continue;
            }

            if (is_array($file)) {
                $flattened += $this->flattenFiles($file, $name);
            }
        }

        return $flattened;
    }

    /**
     * @return array<string, string>
     */
    private function responseHeaders(ClientResponse $response): array
    {
        $headers = [];

        foreach (['content-type', 'content-disposition'] as $header) {
            $value = $response->header($header);

            if ($value !== null) {
                $headers[$header] = $value;
            }
        }

        return $headers;
    }
}
