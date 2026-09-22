# ð DC Control App - VersiÃ³n v50 (Arquitectura de Escritorio Premium)

Â¡Bienvenido a la versiÃ³n definitiva del sistema, mi bro! Esta versiÃ³n tiene incorporadas todas tus reglas de negocio e integra los dashboards ejecutivos e informes directos a PC sin parpadeos de carga.

## ð ï¸ Requisitos de InstalaciÃ³n en tu PC

Para correr la aplicaciÃ³n en su versiÃ³n de desarrollo y compilar tu instalador oficial de Windows `.exe`:

1.  **Instala Node.js:** Descarga e instala Node.js (versiÃ³n 18 o superior) desde https://nodejs.org.
2.  **Instala Python:** AsegÃºrate de tener Python 3.10 o superior instalado con `pip` y agrÃ©galo a las variables de entorno de Windows.
3.  **LibrerÃ­as Necesarias:** Abre tu consola y corre:
    ```bash
    pip install fastapi uvicorn requests psycopg2-binary python-docx matplotlib pandas
    ```

## ð Â¿CÃ³mo levantar la aplicaciÃ³n en 1 Segundo?

1.  Descomprime este proyecto.
2.  Abre la terminal de Windows en esta carpeta (`DC_Control_App_v50`) y corre:
    ```bash
    npm install
    ```
3.  Para arrancar simultÃ¡neamente el backend en FastAPI y la ventana de escritorio nativa en React:
    ```bash
    npm start
    ```

Â¡Eso es todo! Se abrirÃ¡ la hermosa ventana independiente con tu sistema operando al microsegundo.
