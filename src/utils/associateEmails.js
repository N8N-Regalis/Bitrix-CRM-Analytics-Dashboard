// Mapping of email -> associate name for submissions sourcer_email resolution.
// This is populated from the Bitrix REST user.get endpoint and kept in sync
// with associateNames.js — update this if new sourcers are added to Bitrix.
// TODO: Long-term fix is for the sync server to write a users table to Supabase.

export const ASSOCIATE_EMAILS = {
  'n8n@regaliscapital.com': 'Admin Account',
  'el-jay@regaliscapital.com': 'El-jay D.',
  'zafar@regaliscapital.com': 'Zafar',
  'raldz@regaliscapital.com': 'Raldz Borja',
  'kristyl@regaliscapital.com': 'Kristyl',
  'jamil@regaliscapital.com': 'Jamil Velji',
  'jesusa@regaliscapital.com': 'Ma. Jesusa Joshua Acenas',
  'lemmuel@regaliscapital.com': 'Lemmuel Rafael De Guzman',
  'julia@regaliscapital.com': 'Julia Laroya',
  'jonathan.nillasca@regaliscapital.com': 'Juni',
  'leandroff@regaliscapital.com': 'Leandroff Jose Dela Cruz Villanueva',
  'alyssa@regaliscapital.com': 'Alyssa Santos',
  'ayrah.caye@regaliscapital.com': 'Ayrah Reeham Angantap Caye',
  'roxette@regaliscapital.com': 'Ma. Roxette Molina Rojas',
  'ryan@regaliscapital.com': 'Ryan Rayos',
  'nicole@regaliscapital.com': 'Nicole',
  'clarisse@regaliscapital.com': 'Clarisse Genica Ruiz Arbolante',
  'shaine@regaliscapital.com': 'Shaine Diaz',
  'becky@regaliscapital.com': 'Becky Elizabeth Tumindeg Thompson',
  'ian@regaliscapital.com': 'John Ian Panaglima Diamante',
  'samantha@regaliscapital.com': 'Samantha Alleah Biros Tan',
  'sharelle@regaliscapital.com': 'Sharelle Ayo Paroco',
  'emmanuel@regaliscapital.com': 'Emmanuel Dominguez Amboya',
  'jerome@regaliscapital.com': 'Jerome Montecalvo',
  'mary@regaliscapital.com': 'Mary Reyes',
  'hugh@regaliscapital.com': 'Hugh Sasil',
  'jov@regaliscapital.com': 'Jov',
  'shekinah@regaliscapital.com': 'Shekinah Rivera',
  'paul@regaliscapital.com': 'Paul Chamberlain Vargas Cornejo III',
  'racquel@regaliscapital.com': 'Racquel Alonzo Moran',
  'jasper@regaliscapital.com': 'Jasper Mikhail Perez Abad',
  'jennie@regaliscapital.com': 'Jennie Rose Marquez Miranda',
  'joshua@regaliscapital.com': 'Joshua Noble',
  'jubal@regaliscapital.com': 'Jan Jubal Cruz Atuan',
  'john.sandoval@regaliscapital.com': 'John Carlo Adalin Sandoval',
  'jericka@regaliscapital.com': 'Jericka Celine Ching Mapula',
  'mareya@regaliscapital.com': 'Mareya Martinez',
  'oyo@regaliscapital.com': 'Oyo Boy Bunag',
  'camille@regaliscapital.com': 'Camille Gelica Tayag Balagtas',
  'martin@regaliscapital.com': 'Martin Pasamonte',
  'marty@regaliscapital.com': 'Marty Jude Kuizon Aguilar',
  'catherine@regaliscapital.com': 'Catherine Carupo Araneta',
  'ronald@regaliscapital.com': 'Ronald Maynigo',
  'blessed@regaliscapital.com': 'Blessed Cayong Tamania',
  'shermaine@regaliscapital.com': 'Shermaine Ayo Paroco',
  'nikki@regaliscapital.com': 'Nikki',
  'aldwin@regaliscapital.com': 'Aldwin Dabuet Albite',
  'amiel@regaliscapital.com': 'Amiel',
  'jessa@regaliscapital.com': 'Jessa May Tadeo Encabo',
  'neekish@regaliscapital.com': 'Neekish Blaire Salcedo Dicon',
};

export function getAssociateLabelByEmail(email) {
  if (!email) return 'Unknown';
  const normalized = email.toLowerCase().trim();
  return ASSOCIATE_EMAILS[normalized] || email;
}
