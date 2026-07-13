"""Test security utilities - password hashing and JWT."""
import sys
import os
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import jwt
from utils.security import hash_password, verify_password, create_access_token
from config import settings


class TestPasswordHashing:
    """Tests for password hashing and verification."""

    def test_hash_password_generates_valid_hash(self):
        """hash_password should return a bcrypt hash string."""
        password = "MySecureP@ss123"
        hashed = hash_password(password)
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        # bcrypt hashes start with $2b$ or $2a$
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_verify_password_correct(self):
        """verify_password should return True for correct password."""
        password = "MySecureP@ss123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """verify_password should return False for incorrect password."""
        password = "MySecureP@ss123"
        wrong_password = "WrongPassword456"
        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False

    def test_hash_is_different_each_time(self):
        """Each call to hash_password with the same password should produce a different hash (due to salt)."""
        password = "SamePassword!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2
        # But both should verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTTokens:
    """Tests for JWT token creation and decoding."""

    def test_create_access_token_returns_string(self):
        """create_access_token should return a JWT string."""
        token = create_access_token(data={"sub": "user-123", "role": "TEACHER"})
        assert isinstance(token, str)
        assert len(token) > 0
        # JWT has 3 parts separated by dots
        assert token.count(".") == 2

    def test_create_access_token_decodable(self):
        """The generated token should be decodable with the same secret."""
        data = {"sub": "user-123", "role": "TEACHER", "tenant_id": "tenant-1"}
        token = create_access_token(data=data)
        decoded = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        assert decoded["sub"] == "user-123"
        assert decoded["role"] == "TEACHER"
        assert decoded["tenant_id"] == "tenant-1"

    def test_token_contains_expiration(self):
        """Token should include an 'exp' claim."""
        token = create_access_token(data={"sub": "user-123"})
        decoded = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        assert "exp" in decoded
