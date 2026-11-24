<?php

namespace App\Services;

use RuntimeException;

/** Something in the mail itself is wrong: trying again would not help. */
class MailSendProblem extends RuntimeException {}
