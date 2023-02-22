from django.contrib.auth.tokens import PasswordResetTokenGenerator
from six import text_type
class AppTokenGenerator(PasswordResetTokenGenerator):

    def _make_hash_value(self, user, timestamp: int) -> str:
        return (text_type(user.is_active)+text_type(user.email)+text_type(timestamp))
    
token_generator =AppTokenGenerator()