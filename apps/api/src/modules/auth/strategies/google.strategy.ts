import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('oauth.google.clientId'),
      clientSecret: config.getOrThrow<string>('oauth.google.clientSecret'),
      callbackURL: config.getOrThrow<string>('oauth.google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error('Google profile missing email');

    return {
      googleId: profile.id,
      email,
      firstName: profile.name?.givenName ?? '',
      lastName: profile.name?.familyName ?? '',
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
