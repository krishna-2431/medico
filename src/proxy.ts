import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/symptoms/:path*",
    "/medicine/:path*",
    "/labs/:path*",
    "/doctors/:path*",
    "/tips/:path*",
    "/emergency/:path*",
    "/reminders/:path*",
    "/chat/:path*",
    "/settings/:path*",
  ],
};
