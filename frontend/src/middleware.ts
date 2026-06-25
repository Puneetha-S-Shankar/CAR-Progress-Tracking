import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "better-auth/types";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/companies", "/drives", "/placements"];

export default async function authMiddleware(request: NextRequest) {
    const pathName = request.nextUrl.pathname;
    const isProtectedRoute = protectedRoutes.some(route => pathName.startsWith(route));

    if (!isProtectedRoute) {
        return NextResponse.next();
    }

    const { data: session } = await betterFetch<Session>(
        "/api/auth/get-session",
        {
            baseURL: process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin,
            headers: {
                //get the cookie from the request
                cookie: request.headers.get("cookie") || "",
            },
        },
    );

    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.jpeg).*)"],
};
