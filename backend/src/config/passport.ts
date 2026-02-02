import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import prisma from './database';
import config from './env';

// Local Strategy (Email/Password)
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.passwordHash) {
          return done(null, false, { message: 'Please use Google login for this account' });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// JWT Strategy
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.secret,
    },
    async (payload, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
        });

        if (!user) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// Google OAuth Strategy (only configure if credentials are provided)
if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists with this Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with this email
          const email = profile.emails?.[0]?.value;
          if (email) {
            user = await prisma.user.findUnique({
              where: { email: email.toLowerCase() },
            });

            if (user) {
              // Link Google account to existing user
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id },
              });
              return done(null, user);
            }
          }

          // Create new user
          if (email) {
            const displayName = profile.displayName || email.split('@')[0];
            const nameParts = displayName.split(' ');
            const firstName = nameParts[0] || 'User';
            const lastName = nameParts.slice(1).join(' ') || firstName;

            user = await prisma.user.create({
              data: {
                email: email.toLowerCase(),
                googleId: profile.id,
                firstName,
                lastName,
                role: 'USER',
              },
            });
            return done(null, user);
          }

          return done(new Error('No email provided by Google'), false);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );
}

export default passport;
