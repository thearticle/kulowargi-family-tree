import { FamilyMember } from './types';

export const SAMPLE_FAMILY: FamilyMember[] = [
  // ==========================================
  // GENERATION 1: GREAT-GRANDPARENTS (Roots)
  // ==========================================
  {
    id: 'g1_1',
    name: 'Raden Soedirdjo',
    gender: 'male',
    birthYear: '1932',
    deathYear: '2012',
    avatar: '👴',
    notes: 'Pioneer batik merchant in Solo. Known for his patience, gardening passion, and collection of classic Javanese literature.',
    parentIds: [],
    spouseIds: ['g1_2'],
  },
  {
    id: 'g1_2',
    name: 'Siti Wahyuningsih',
    gender: 'female',
    birthYear: '1936',
    deathYear: '2019',
    avatar: '👵',
    notes: 'Matriarch of the family, master traditional herbalist (jamu), and keeper of four generations of family recipes.',
    parentIds: [],
    spouseIds: ['g1_1'],
  },

  // ==========================================
  // GENERATION 2: GRANDPARENTS (Branches)
  // ==========================================
  {
    id: 'g2_1',
    name: 'Bambang Soedirdjo',
    gender: 'male',
    birthYear: '1958',
    avatar: '👨',
    notes: 'Eldest son. Retired civil engineer who supervised bridge projects across Java. Passionate chess player.',
    parentIds: ['g1_1', 'g1_2'],
    spouseIds: ['g2_2'],
  },
  {
    id: 'g2_2',
    name: 'Sri Rahayu Kusuma',
    gender: 'female',
    birthYear: '1961',
    avatar: '🧕',
    notes: 'High school mathematics educator for 32 years. Active volunteer in community literacy programs.',
    parentIds: [],
    spouseIds: ['g2_1'],
  },
  {
    id: 'g2_3',
    name: 'Dewi Anggraini',
    gender: 'female',
    birthYear: '1963',
    avatar: '👩',
    notes: 'Second child. Pediatric nurse supervisor and community health clinic coordinator.',
    parentIds: ['g1_1', 'g1_2'],
    spouseIds: ['g2_4'],
  },
  {
    id: 'g2_4',
    name: 'Hendro Gunawan',
    gender: 'male',
    birthYear: '1960',
    avatar: '🧔',
    notes: 'Botanist and tropical fruit orchard specialist. Loves acoustic guitar and mountain hiking.',
    parentIds: [],
    spouseIds: ['g2_3'],
  },

  // ==========================================
  // GENERATION 3: PARENTS (Vibrant Core)
  // ==========================================
  {
    id: 'g3_1',
    name: 'Aryo Soedirdjo',
    gender: 'male',
    birthYear: '1984',
    avatar: '👨',
    notes: 'Software architect and tech team mentor. Loves trail running, photography, and pour-over coffee.',
    parentIds: ['g2_1', 'g2_2'],
    spouseIds: ['g3_2'],
  },
  {
    id: 'g3_2',
    name: 'Citra Kirana',
    gender: 'female',
    birthYear: '1986',
    avatar: '🧕',
    notes: 'Architectural interior designer specializing in sustainable bamboo living spaces. Classical pianist.',
    parentIds: [],
    spouseIds: ['g3_1'],
  },
  {
    id: 'g3_3',
    name: 'Bima Soedirdjo',
    gender: 'male',
    birthYear: '1989',
    avatar: '🧑',
    notes: 'Marine biologist and coral reef conservationist based in Bali. Certified master rescue diver.',
    parentIds: ['g2_1', 'g2_2'],
    spouseIds: ['g3_4'],
  },
  {
    id: 'g3_4',
    name: 'Nadia Safitri',
    gender: 'female',
    birthYear: '1991',
    avatar: '👩',
    notes: 'Documentary filmmaker and photojournalist covering Southeast Asian wildlife.',
    parentIds: [],
    spouseIds: ['g3_3'],
  },
  {
    id: 'g3_5',
    name: 'Farhan Gunawan',
    gender: 'male',
    birthYear: '1988',
    avatar: '🧔',
    notes: 'Artisan baker and owner of a sourdough bakery in Bandung. Marathon runner.',
    parentIds: ['g2_3', 'g2_4'],
    spouseIds: ['g3_6'],
  },
  {
    id: 'g3_6',
    name: 'Alya Pramesti',
    gender: 'female',
    birthYear: '1990',
    avatar: '👩',
    notes: 'Clinical child psychologist and author of interactive children storybooks.',
    parentIds: [],
    spouseIds: ['g3_5'],
  },

  // ==========================================
  // GENERATION 4: GREAT-GRANDCHILDREN (New Shoots)
  // ==========================================
  {
    id: 'g4_1',
    name: 'Kenzo Soedirdjo',
    gender: 'male',
    birthYear: '2014',
    avatar: '👦',
    notes: 'Elementary science olympiad medalist, LEGO robotics enthusiast, and budding junior soccer goalkeeper.',
    parentIds: ['g3_1', 'g3_2'],
    spouseIds: [],
  },
  {
    id: 'g4_2',
    name: 'Alana Soedirdjo',
    gender: 'female',
    birthYear: '2018',
    avatar: '👧',
    notes: 'Loves finger painting, dinosaur encyclopedias, and singing traditional songs with her grandmother.',
    parentIds: ['g3_1', 'g3_2'],
    spouseIds: [],
  },
  {
    id: 'g4_3',
    name: 'Samudra Soedirdjo',
    gender: 'male',
    birthYear: '2021',
    avatar: '🧒',
    notes: 'Energetic toddler who loves beach visits, swimming, and playing with his toy boat collection.',
    parentIds: ['g3_3', 'g3_4'],
    spouseIds: [],
  },
  {
    id: 'g4_4',
    name: 'Kalea Gunawan',
    gender: 'female',
    birthYear: '2023',
    avatar: '👶',
    notes: 'The youngest family member. Loves picture books, music boxes, and bright colorful shapes.',
    parentIds: ['g3_5', 'g3_6'],
    spouseIds: [],
  },
];

export const AVATAR_PRESETS = [
  '👶', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧔',
  '👱', '🧕', '👲', '👳', '🧓', '👴', '👵', '👸',
];
