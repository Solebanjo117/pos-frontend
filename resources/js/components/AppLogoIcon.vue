<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

type Props = {
    className?: HTMLAttributes['class'];
};

defineProps<Props>();
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="300 250 400 450"
        :class="className"
        v-bind="$attrs"
    >
        <defs>
            <!-- Gradiente metálico dorado principal -->
            <linearGradient id="goldFlow" x1="10%" y1="0%" x2="90%" y2="100%">
                <stop offset="0%" stop-color="#F3C34B" />
                <stop offset="25%" stop-color="#FFDF73" />
                <stop offset="50%" stop-color="#D4982A" />
                <stop offset="75%" stop-color="#F5D053" />
                <stop offset="100%" stop-color="#B87311" />
            </linearGradient>

            <linearGradient id="wingGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stop-color="#D4982A" />
                <stop offset="100%" stop-color="#FFDF73" />
            </linearGradient>

            <!-- Máscara para recortes transparentes (separaciones y el rayo) -->
            <mask id="bootMask">
                <!-- Fondo blanco (lo que se dibuja aquí será visible) -->
                <rect x="0" y="0" width="1000" height="1000" fill="white" />
                
                <!-- Cortes de las correas de la bota -->
                <line x1="395" y1="605" x2="415" y2="655" stroke="black" stroke-width="7" stroke-linecap="round" />
                <line x1="420" y1="570" x2="450" y2="655" stroke="black" stroke-width="7" stroke-linecap="round" />
                <line x1="450" y1="535" x2="490" y2="630" stroke="black" stroke-width="7" stroke-linecap="round" />
                
                <!-- Corte de la suela -->
                <path d="M 360 635 C 430 663 510 635 560 590" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
                
                <!-- Corte del rayo centrado en el tobillo -->
                <polygon points="510,515 525,515 505,545 515,545 490,580 500,552 485,552" fill="black" />
            </mask>

            <!-- Sombra sutil para darle profundidad y aspecto "premium" -->
            <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
            </filter>
        </defs>
        
        <g transform="translate(0, -30)" filter="url(#shadow)">
            
            <!-- Barras de Crecimiento (al fondo) -->
            <rect x="440" y="440" width="14" height="60" fill="url(#goldFlow)" rx="2" />
            <rect x="470" y="390" width="14" height="110" fill="url(#goldFlow)" rx="2" />
            <rect x="500" y="340" width="14" height="160" fill="url(#goldFlow)" rx="2" />

            <!-- Alas estilizadas (dibujadas hacia atrás) con separación visual -->
            <g stroke="#0b0d0c" stroke-width="4" stroke-linejoin="round">
                <!-- Capa inferior (Pluma más baja) -->
                <path d="M 500 550 C 530 535 575 515 600 510 C 565 535 540 555 520 565 Z" fill="url(#goldFlow)" />
                <path d="M 500 538 C 535 520 585 495 620 485 C 575 515 545 540 525 555 Z" fill="url(#goldFlow)" />
                <path d="M 500 525 C 545 500 595 470 640 455 C 585 490 550 520 525 540 Z" fill="url(#goldFlow)" />
                <!-- Capa superior (Pluma principal) -->
                <path d="M 500 510 C 550 480 610 440 660 420 C 600 460 560 500 520 525 Z" fill="url(#goldFlow)" />
            </g>

            <!-- Base sólida de la bota aplicando máscara para recortes perfectos -->
            <path d="M 480 500 
                     C 450 520 400 580 370 640
                     C 430 670 510 645 555 600
                     L 535 500 Z" 
                  fill="url(#goldFlow)" 
                  mask="url(#bootMask)" />
        </g>
    </svg>
</template>
